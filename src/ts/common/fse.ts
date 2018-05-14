import * as fs from 'fs'
import * as path from 'path'

function copyFile (oldPath: string, newPath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    let rs = fs.createReadStream(oldPath)
    rs.on('error', err => reject(err))
    let ws = fs.createWriteStream(newPath)
    ws.on('error', err => reject(err))
    ws.on('close', () => {
      resolve([oldPath, newPath])
    })
    rs.pipe(ws)
  })
}

function copyFolder (oldPath: string, newPath: string, ignore?: RegExp): Promise<string[][]> {
  let task: Promise<any>[] = []
  const files = fs.readdirSync(oldPath)
  if (!fs.existsSync(newPath)) fs.mkdirSync(newPath)
  for (let i = 0; i < files.length; i++) {
    let oldFile = path.join(oldPath, files[i])
    let newFile = path.join(newPath, files[i])
    if (ignore) {
      if (!ignore.test(oldFile)) {
        task.push(fs.statSync(oldFile).isFile() ? copyFile(oldFile, newFile) : copyFolder(oldFile, newFile, ignore))
      }
    } else {
      task.push(fs.statSync(oldFile).isFile() ? copyFile(oldFile, newFile) : copyFolder(oldFile, newFile))
    }
  }
  return task.length ? Promise.all(task) : Promise.resolve([])
}

function removeFile (filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, err => {
      if (err) reject(err)
      else resolve(filePath)
    })
  })
}

function removeFolder (folderPath: string): Promise<any[]> {
  let task: Promise<any>[] = []
  const files = fs.readdirSync(folderPath)
  if (files.length) {
    for (let i = 0; i < files.length; i++) {
      let file = path.join(folderPath, files[i])
      task.push(fs.statSync(file).isFile() ? removeFile(file) : removeFolder(file))
    }
    return Promise.all(task).then((arr: any[]) => {
      fs.rmdirSync(folderPath)
      return arr
    })
  } else {
    fs.rmdirSync(folderPath)
    return Promise.resolve([])
  }
}

function copy (src: string, tar: string, ignore?: RegExp): Promise<string[] | string[][]> {
  return new Promise((resolve, reject) => {
    fs.stat(src, (err, stats) => {
      if (!err) {
        if (stats.isFile()) resolve(copyFile(src, tar))
        else resolve(copyFolder(src, tar, ignore))
      } else reject(err)
    })
  })
}

function remove (src: string): Promise<any> {
  return new Promise((resolve, reject) => {
    fs.stat(src, (err, stats) => {
      if (!err) {
        if (stats.isFile()) resolve(removeFile(src))
        else resolve(removeFolder(src))
      } else reject(err)
    })
  })
}

function read (file: string, option?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    fs.readFile(file, option, (err, data) => {
      if (err) reject(err)
      else resolve(data)
    })
  })
}

function write (file: string, data: any, option?: any): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.writeFile(file, data, option, (err) => {
      if (err) reject(err)
      else resolve(file)
    })
  })
}

function mdSync (p: string) {
  const dir = path.dirname(p)
  if (!fs.existsSync(dir)) mdSync(dir)
  else if (!fs.statSync(dir).isDirectory()) throw new Error(`"${path.resolve(dir)}" is not a dictory.`)
  fs.mkdirSync(p)
}

export { copy, remove, read, write, mdSync }
