import 'dotenv/config'

import path from 'node:path'
import fs from 'node:fs/promises'
import childProcess from 'node:child_process'

import { Scan } from './3d-scanner-app.js'

const action = process.argv[2]
const inputRaw = process.argv[3]
const outputRaw = process.argv[4]

const COLMAP = process.env.COLMAP
const BLENDER = process.env.BLENDER
const COLIBRI_VR_UNITY_PACKAGE = process.env.COLIBRI_VR_UNITY_PACKAGE
const REMBG = process.env.REMBG

const input = path.resolve(inputRaw)
const output = path.resolve(outputRaw)
const outputImages = path.join(output, 'images')
const outputMasks = path.join(output, 'masks')
const databasePath = path.join(output, 'database.db')
const sparsePath = path.join(output, 'sparse')
const triangulatedPath = path.join(output, 'triangulated')
const densePath = path.join(output, 'dense')

switch (action) {
  case 'colmap-model':
    await createCOLMAPModel()
    break
  case 'render':
    await createRendering()
    break
  default:
    throw new Error('Unknown action')
}

async function createCOLMAPModel(repositionAroundCenter) {
  await fs.rm(output, { recursive: true, force: true })
  await fs.mkdir(output)
  await fs.mkdir(sparsePath)
  await fs.mkdir(outputImages)

  const scan = new Scan(input)
  const model = await scan.toCOLMAPModel(repositionAroundCenter)

  await Promise.all(
    model.images.map(async (image) => {
      await fs.copyFile(
        image,
        path.join(output, 'images', path.parse(image).base),
      )
    }),
  )

  await fs.writeFile(path.join(sparsePath, 'cameras.txt'), model.camerasRaw, {
    encoding: 'utf-8',
  })
  await fs.writeFile(path.join(sparsePath, 'images.txt'), model.imagesRaw, {
    encoding: 'utf-8',
  })
  await fs.writeFile(path.join(sparsePath, 'points3D.txt'), model.points3DRaw, {
    encoding: 'utf-8',
  })
}

async function createRendering() {
  await createCOLMAPModel(true)
  await fs.mkdir(outputMasks)

  await handleMasked()
  await handleReconstruction()
  await handleBlender()
}

async function handleMasked() {
  await spawnCommand(REMBG, ['p', '-om', outputImages, outputMasks])

  const images = await fs.readdir(outputImages)

  for (let image of images) {
    const name = path.parse(image).name
    await fs.rename(
      path.join(outputMasks, `${name}.png`),
      path.join(outputMasks, `${image}.png`),
    )
  }
}

async function handleReconstruction() {
  const imagesPath = outputImages

  await spawnCommand(
    COLMAP,
    [
      'feature_extractor',
      '--database_path',
      databasePath,
      '--image_path',
      imagesPath,
      '--ImageReader.mask_path',
      outputMasks,
      '--ImageReader.camera_model',
      'PINHOLE',
    ],
    {
      cwd: sparsePath,
    },
  )

  await spawnCommand(COLMAP, [
    'exhaustive_matcher',
    '--database_path',
    databasePath,
  ])

  await fs.mkdir(triangulatedPath)
  await spawnCommand(COLMAP, [
    'point_triangulator',
    '--database_path',
    databasePath,
    '--image_path',
    imagesPath,
    '--input_path',
    sparsePath,
    '--output_path',
    triangulatedPath,
  ])

  await spawnCommand(COLMAP, [
    'model_converter',
    '--input_path',
    triangulatedPath,
    '--output_path',
    triangulatedPath,
    '--output_type',
    'TXT',
  ])

  await fs.mkdir(densePath)
  await spawnCommand(COLMAP, [
    'image_undistorter',
    '--image_path',
    imagesPath,
    '--input_path',
    triangulatedPath,
    '--output_path',
    densePath,
    '--output_type',
    'COLMAP',
    '--max_image_size',
    '2000',
  ])
  await spawnCommand(COLMAP, [
    'model_converter',
    '--input_path',
    path.join(densePath, 'sparse'),
    '--output_path',
    path.join(densePath, 'sparse'),
    '--output_type',
    'TXT',
  ])

  await spawnCommand(COLMAP, [
    'patch_match_stereo',
    '--workspace_path',
    densePath,
    '--workspace_format',
    'COLMAP',
  ])

  await spawnCommand(COLMAP, [
    'stereo_fusion',
    '--workspace_path',
    densePath,
    '--workspace_format',
    'COLMAP',
    '--output_path',
    path.join(densePath, 'fused.ply'),
  ])

  await spawnCommand(COLMAP, [
    'delaunay_mesher',
    '--input_path',
    densePath,
    '--output_path',
    path.join(densePath, 'meshed_delaunay.ply'),
  ])
}

async function handleBlender() {
  await spawnCommand(BLENDER, [
    '--factory-startup',
    '--background',
    '--python',
    path.join(
      COLIBRI_VR_UNITY_PACKAGE,
      '.\\Runtime\\ExternalConnectors\\Blender_ConvertPLYtoOBJ.py',
    ),
    '--',
    path.join(COLIBRI_VR_UNITY_PACKAGE, '.\\Runtime\\ExternalConnectors'),
    path.join(densePath, 'meshed_delaunay.ply'),
    path.join(densePath, 'meshed_delaunay.obj'),
  ])
}

async function spawnCommand(command, args, options = {}) {
  console.log(`Running command: ${command} ${args.join(' ')}`)
  const p = childProcess.spawn(command, args, { ...options, stdio: 'inherit' })
  return new Promise((resolve, reject) => {
    p.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command exited with code ${code}`))
      }
    })
  })
}
