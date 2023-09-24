import { Quaternion, Vector3 } from 'three'

export class CameraPose {
  constructor() {
    this.position = new Vector3()
    this.quaternion = new Quaternion()
  }

  static fromARKit({ position, quaternion }) {
    // Convert from ARKit's right-handed coordinate system to Unity's left-handed
    const pose = new CameraPose()

    pose.position.copy(position)
    pose.position.z = -pose.position.z

    pose.quaternion.copy(quaternion)
    pose.quaternion.z = -pose.quaternion.z
    pose.quaternion.w = -pose.quaternion.w

    return pose
  }

  static fromCOLMAP({ position, quaternion }) {
    const pose = new CameraPose()

    pose.quaternion.copy(quaternion)
    pose.quaternion.normalize().invert()

    pose.position.copy(position)
    pose.position.multiplyScalar(-1)
    pose.position.applyQuaternion(pose.quaternion)
    pose.position.y = -pose.position.y

    pose.quaternion.x = -pose.quaternion.x
    pose.quaternion.z = -pose.quaternion.z

    return pose
  }

  toARKit() {
    const position = this.position.clone()
    position.z = -position.z

    const quaternion = this.quaternion.clone()
    quaternion.z = -quaternion.z
    quaternion.w = -quaternion.w

    return { position, quaternion }
  }

  toCOLMAP() {
    const position = this.position.clone()
    position.y = -position.y

    const quaternion = this.quaternion.clone()
    quaternion.x = -quaternion.x
    quaternion.z = -quaternion.z
    quaternion.normalize().invert()

    position.multiplyScalar(-1)
    position.applyQuaternion(quaternion)

    return { position, quaternion }
  }
}
