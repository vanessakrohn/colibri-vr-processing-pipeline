import fs from 'node:fs/promises'
import path from 'node:path'
import * as R from 'ramda'
import { Matrix4, Quaternion, Vector3 } from 'three'

import { CameraPose } from './camera-pose.js'
import imageSize from 'image-size'

export class Scan {
  constructor(folder) {
    this.folder = folder
  }

  get imagesFolder() {
    return path.join(this.folder, 'images_resized')
  }

  get posesFolder() {
    return path.join(this.folder, 'optimized_poses')
  }

  async toCOLMAPModel(repositionAroundCenter) {
    const camerasRaw = await this.camerasRaw()
    const imagesRaw = await this.imagesRaw(repositionAroundCenter)
    const files = await this.readInputFiles()
    return {
      imagesRaw,
      camerasRaw,
      points3DRaw: '',
      images: files.map((file) => {
        return file.image
      }),
    }
  }

  async camerasRaw() {
    const [first] = await this.readInputFiles()
    const dimensions = imageSize(first.image)
    const { intrinsics } = JSON.parse(first.poseRaw)
    const [
      scaledFocalX,
      _m12,
      scaledOffsetX,
      _m21,
      scaledFocalY,
      scaledOffsetY,
      _m31,
      _m32,
      scale,
    ] = intrinsics

    const camerasTxtLines = [
      '# Camera list with one line of data per camera:',
      '#   CAMERA_ID, MODEL, WIDTH, HEIGHT, PARAMS[]',
      '# Number of cameras: 1',
      `1 PINHOLE ${dimensions.width} ${dimensions.height} ${
        scaledFocalX / scale
      } ${scaledFocalY / scale} ${scaledOffsetX / scale} ${
        scaledOffsetY / scale
      }`,
    ]
    return camerasTxtLines.join('\n')
  }

  async imagesRaw(repositionAroundCenter) {
    const files = await this.readInputFiles()
    const poses = files.map((file) => {
      return {
        image: file.image,
        cameraPose: parseCameraPose(file.poseRaw),
      }
    })

    if (repositionAroundCenter) {
      const meanPosition = new Vector3()
      for (let pose of poses) {
        meanPosition.add(pose.cameraPose.position)
      }
      meanPosition.divideScalar(poses.length)
      for (let pose of poses) {
        pose.cameraPose.position.sub(meanPosition)
      }
    }

    const imagesRawLines = R.flatten(
      poses.map((pose, index) => {
        const { position, quaternion } = pose.cameraPose.toCOLMAP()

        return [
          `${index + 1} ${quaternion.w} ${quaternion.x} ${quaternion.y} ${
            quaternion.z
          } ${position.x} ${position.y} ${position.z} 1 ${
            path.parse(pose.image).base
          }`,
          '',
        ]
      }),
    )

    return [
      '# Image list with two lines of data per image:',
      '#   IMAGE_ID, QW, QX, QY, QZ, TX, TY, TZ, CAMERA_ID, NAME',
      '#   <EMPTY LINE>',
      `# Number of images: ${poses.length}`,
      ...imagesRawLines,
    ].join('\n')
  }

  async readInputFiles() {
    if (this.readInputFilesCache) return this.readInputFilesCache

    const [images, poses] = await Promise.all([
      fs.readdir(this.imagesFolder),
      fs.readdir(this.posesFolder),
    ])

    const imageFileNames = images.map((image) => path.parse(image).name)
    const imageExtension = path.parse(images[0]).ext

    const poseFileNames = poses.map((pose) => path.parse(pose).name)
    const poseExtension = path.parse(poses[0]).ext

    const usableFileNames = R.intersection(imageFileNames, poseFileNames)
    const result = await Promise.all(
      usableFileNames.map(async (fileName) => {
        return {
          image: path.join(this.imagesFolder, `${fileName}${imageExtension}`),
          poseRaw: await fs.readFile(
            path.join(this.posesFolder, `${fileName}${poseExtension}`),
            { encoding: 'utf-8' },
          ),
        }
      }),
    )

    this.readInputFilesCache = result
    return result
  }
}

/**
 * Parses a 3D Scanner App camera pose JSON file (taken from the `optimized_poses` folder)
 *
 * @param {string} poseRaw - The content of the frame_*.json file
 * @returns {CameraPose}
 */
export function parseCameraPose(poseRaw) {
  const { cameraPoseARFrame } = JSON.parse(poseRaw)

  const matrix = new Matrix4()
  matrix.set(...cameraPoseARFrame)

  const position = new Vector3().setFromMatrixPosition(matrix)
  const quaternion = new Quaternion().setFromRotationMatrix(matrix)

  return CameraPose.fromARKit({ position, quaternion })
}
