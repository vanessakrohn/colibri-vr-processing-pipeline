import { parseCameraPose } from './3d-scanner-app.js'

test('parseCameraPose, toCOLMAP', () => {
  const poseRaw = `{
    "cameraPoseARFrame": [
      0.09051449596881866, 0.5922887921333313, 0.8006254434585571,
      -0.04083283990621567, -0.9924026131629944, -0.01362601201981306,
      0.12227609753608704, -0.04024965316057205, 0.08333209156990051,
      -0.8056105375289917, 0.586555540561676, -0.007707570679485798, 0.0, -0.0,
      -0.0, 1.0
    ],
    "intrinsics": [
      1304.9840087890625, 0.0, 958.1058349609375, 0.0, 1304.9840087890625,
      539.3325805664063, 0.0, 0.0, 3.0
    ],
    "projectionMatrix": [
      1.5102115869522095, 0.0, 0.015301764011383057, 0.0, 0.0, 2.013615369796753,
      -0.003615260124206543, 0.0, 0.0, 0.0, -0.9999997615814209,
      -0.0009999998146668077, 0.0, 0.0, -1.0, 0.0
    ],
    "time": 555656.0219493752
  }`
  const pose = parseCameraPose(poseRaw)

  const arkitPosition = pose.toARKit().position
  expect(arkitPosition.x).toBeCloseTo(-0.04083283990621567)
  expect(arkitPosition.y).toBeCloseTo(-0.04024965316057205)
  expect(arkitPosition.z).toBeCloseTo(-0.007707570679485798)

  const colmapPosition = pose.toCOLMAP().position
  expect(colmapPosition.x).toBeCloseTo(-0.03560559)
  expect(colmapPosition.y).toBeCloseTo(-0.01742716)
  expect(colmapPosition.z).toBeCloseTo(-0.04213444)

  const colmapRotation = pose.toCOLMAP().quaternion
  expect(colmapRotation.w).toBeCloseTo(-0.6448728)
  expect(colmapRotation.x).toBeCloseTo(-0.3597169)
  expect(colmapRotation.y).toBeCloseTo(-0.2780755)
  expect(colmapRotation.z).toBeCloseTo(0.6143426)
})
