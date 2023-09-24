import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Scan } from './3d-scanner-app.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('createCOLMAPModelFrom3DScannerApp', async () => {
  const folder = path.join(__dirname, '../input/2023_05_06_13_16_14')
  const scan = new Scan(folder)
  const model = await scan.toCOLMAPModel(folder)

  console.log(model)
})
