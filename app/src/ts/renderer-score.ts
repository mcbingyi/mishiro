import '../css/game.css'
import { ipcRenderer, remote } from 'electron'
import { parse, relative } from 'path'
import { ScoreNote } from './main/on-score'

const tapCanvas = document.createElement('canvas')
const longLoopCanvas = document.createElement('canvas')
const longMoveCanvas = document.createElement('canvas')
const longMoveWhiteCanvas = document.createElement('canvas')
const flipLeftCanvas = document.createElement('canvas')
const flipRightCanvas = document.createElement('canvas')
tapCanvas.width = longLoopCanvas.width = longMoveCanvas.width = longMoveWhiteCanvas.width = tapCanvas.height = longLoopCanvas.height = longMoveCanvas.height = longMoveWhiteCanvas.height = flipLeftCanvas.height = flipRightCanvas.height = 102
flipLeftCanvas.width = flipRightCanvas.width = 125

const iconNotesImg = newImage('../../asset/img.asar/icon_notes.png')
iconNotesImg.addEventListener('load', () => {
  (tapCanvas.getContext('2d') as CanvasRenderingContext2D).drawImage(iconNotesImg, 0, 0, 102, 102, 0, 0, 102, 102);
  (longLoopCanvas.getContext('2d') as CanvasRenderingContext2D).drawImage(iconNotesImg, 102, 0, 102, 102, 0, 0, 102, 102);
  (longMoveCanvas.getContext('2d') as CanvasRenderingContext2D).drawImage(iconNotesImg, 102 + 102, 0, 102, 102, 0, 0, 102, 102);
  (longMoveWhiteCanvas.getContext('2d') as CanvasRenderingContext2D).drawImage(iconNotesImg, 102 + 102 + 102, 0, 102, 102, 0, 0, 102, 102);
  (flipLeftCanvas.getContext('2d') as CanvasRenderingContext2D).drawImage(iconNotesImg, 102 + 102 + 102 + 102, 0, 125, 102, 0, 0, 125, 102);
  (flipRightCanvas.getContext('2d') as CanvasRenderingContext2D).drawImage(iconNotesImg, 102 + 102 + 102 + 102 + 125, 0, 125, 102, 0, 0, 125, 102)
})

interface Song {
  src: string
  bpm: number
  score: ScoreNote[]
  fullCombo: number
}

interface Option {
  speed: number
}

class Score {

  private static _instance: Score | null = null
  public static get (song: Song) {
    return new Score(song)
  }

  private static CANVAS_WIDTH = 1280
  private static CANVAS_HEIGHT = 720
  public static X: number[] = [238, 414, 589, 764, 937]
  private static BOTTOM = 20
  public static TOP_TO_TARGET_POSITION = Score.CANVAS_HEIGHT - Score.BOTTOM - 114 + 6

  public frontCanvas: HTMLCanvasElement
  public backCanvas: HTMLCanvasElement
  public frontCtx: CanvasRenderingContext2D
  public backCtx: CanvasRenderingContext2D
  public song: Song
  public audio: HTMLAudioElement
  public options: Option = {
    speed: 12 // * 60 px / s
  }
  // private _isPlaying: boolean = false
  private _init: boolean = false
  private _isReady: boolean = false
  private _t: number
  private _isClean = true
  private _comboDom: HTMLDivElement

  private _noteList: Note[] = []

  private _preCalculation = {
    timeRange: 10 * ((Score.TOP_TO_TARGET_POSITION + 102) / (this.options.speed * 60))
  }

  public init () {
    if (this._init) return

    let liveIcon = newImage('../../asset/img.asar/live_icon_857x114.png')
    liveIcon.addEventListener('load', () => {
      this.backCtx.drawImage(liveIcon, 211, Score.CANVAS_HEIGHT - Score.BOTTOM - 114)
    }, false)

    this.audio.addEventListener('play', () => {
      console.log(this.audio.duration)
    })

    this.audio.addEventListener('ended', () => {
      window.close()
    }, false)

    this.audio.addEventListener('canplay', () => {
      this._isReady = true
    })

    this.audio.addEventListener('pause', () => {
      console.log(this.audio.currentTime + ' / ' + this.audio.duration)
    })

    this._init = true
  }

  public start () {
    if (!this._isReady) {
      setTimeout(() => {
        this.start()
      }, 100)
      return
    }

    this.audio.play()

    const self = this

    _frame()

    function _frame () {
      const notes = self._cal()
      self._renderNote(notes)
      self._t = window.requestAnimationFrame(_frame)
    }
  }

  public stop () {
    this.audio.pause()
    window.cancelAnimationFrame(this._t)
    this._clear()
  }

  private _clear () {
    if (!this._isClean) {
      this.frontCtx.clearRect(211, 0, 857, Score.CANVAS_HEIGHT - 15)
      this._isClean = true
    }
  }

  private _cal () {
    let begin = -1
    let end = -1
    let combo = -1

    if (this.audio.currentTime <= this.audio.duration / 2) {
      for (let i = 0; i < this.song.score.length; i++) {
        if (this.song.score[i].sec > this.audio.currentTime) {
          combo = i
          break
        }
      }
    } else {
      for (let i = this.song.score.length - 1; i >= 0; i--) {
        if (this.song.score[i].sec <= this.audio.currentTime) {
          combo = i + 1
          break
        }
      }
    }

    begin = combo

    for (let i = begin; i < this.song.score.length; i++) {
      if (this.song.score[i].sec < this.audio.currentTime + this._preCalculation.timeRange) {
        end = i
      } else {
        break
      }
    }

    if (this._comboDom.innerHTML !== '' + combo) this._comboDom.innerHTML = '' + combo
    return (begin !== -1 && end !== -1) ? ((begin << 16) | end) : -1
  }

  private _findLongNote (begin: number, finishPos: number): number {
    for (let i = begin + 1; i < this.song.score.length; i++) {
      if (this.song.score[i].finishPos === finishPos) {
        return i
      }
    }
    return -1
  }

  private _findSameGroup (begin: number, groupId: number): number[] {
    if (groupId === 0) return []
    const index = []
    for (let i = begin + 1; i < this.song.score.length; i++) {
      if (this.song.score[i].groupId === groupId) {
        index.push(i)
      }
    }
    return index
  }

  private _renderNote (notes: number) {

    this._clear()
    if (notes === -1) return
    const begin = (notes & 0xffff0000) >> 16
    const end = notes & 0xffff
    if (this._comboDom.innerHTML !== '' + begin) this._comboDom.innerHTML = '' + begin
    // console.log(begin, end)
    for (let i = end; i >= begin; i--) {
      this._noteList[i].draw(this)
    }
    this._isClean = false
  }

  constructor (song: Song, options?: Option) {
    if (Score._instance) return Score._instance

    if (options) this.options = Object.assign({}, this.options, options)

    this.frontCanvas = document.createElement('canvas')
    this.backCanvas = document.createElement('canvas')
    this.frontCanvas.width = this.backCanvas.width = Score.CANVAS_WIDTH
    this.frontCanvas.height = this.backCanvas.height = Score.CANVAS_HEIGHT
    this.frontCanvas.className = this.backCanvas.className = 'canvas canvas-center'

    document.body.appendChild(this.backCanvas)
    document.body.appendChild(this.frontCanvas)
    this._comboDom = document.getElementById('combo') as HTMLDivElement

    this.frontCtx = this.frontCanvas.getContext('2d') as CanvasRenderingContext2D
    this.backCtx = this.backCanvas.getContext('2d') as CanvasRenderingContext2D
    this.frontCtx.fillStyle = 'rgba(255, 255, 255, 0.66)'
    this.song = song

    let ignore: number[] = []
    for (let i = 0; i < this.song.score.length; i++) {
      if (ignore.includes(i)) {
        continue
      }
      const note = this.song.score[i]
      switch (note.type) {
        case 1:
          if (note.status === 0) {
            this._noteList[i] = new TapNote(note)
          } else {
            const connections = this._findSameGroup(i, note.groupId)
            if (connections.length) {
              ignore = [...ignore, ...connections]
              for (let j = connections.length - 1; j > 0; j--) {
                this._noteList[connections[j]] = new FlipNote(this.song.score[connections[j]], this.song.score[connections[j - 1]])
              }
              this._noteList[connections[0]] = new FlipNote(this.song.score[connections[0]], note)
            }
            this._noteList[i] = new FlipNote(note)
          }
          break
        case 2:
          const connection = this._findLongNote(i, note.finishPos)
          if (connection !== -1) {
            ignore = [...ignore, connection]
            if (this.song.score[connection].type === 1) {
              const connections = this._findSameGroup(connection, this.song.score[connection].groupId)
              if (connections.length) {
                ignore = [...ignore, ...connections]
                for (let j = connections.length - 1; j > 0; j--) {
                  this._noteList[connections[j]] = new FlipNote(this.song.score[connections[j]], this.song.score[connections[j - 1]])
                }
                this._noteList[connections[0]] = new FlipNote(this.song.score[connections[0]], this.song.score[connection])
              }
              this._noteList[connection] = new FlipNote(this.song.score[connection], note)
            } else {
              this._noteList[connection] = new LongNote(this.song.score[connection], note)
            }
          }
          this._noteList[i] = new LongNote(note)
          break
        case 3:
          const connections = this._findSameGroup(i, note.groupId)
          if (connections.length) {
            ignore = [...ignore, ...connections]
            for (let j = connections.length - 1; j > 0; j--) {
              if (this.song.score[connections[j]].type === 3 && this.song.score[connections[j]].status === 0) {
                this._noteList[connections[j]] = new LongMoveNote(this.song.score[connections[j]], this.song.score[connections[j - 1]])
              } else {
                this._noteList[connections[j]] = new FlipNote(this.song.score[connections[j]], this.song.score[connections[j - 1]])
              }
            }
            if (this.song.score[connections[0]].type === 3 && this.song.score[connections[0]].status === 0) {
              this._noteList[connections[0]] = new LongMoveNote(this.song.score[connections[0]], note)
            } else {
              this._noteList[connections[0]] = new FlipNote(this.song.score[connections[0]], note)
            }
          }
          this._noteList[i] = new LongMoveNote(note)
          break
        default:
          break
      }
    }
    console.log(this._noteList)

    this.audio = process.env.NODE_ENV === 'production' ? createAudio(song.src) : createAudio(relative(__dirname, song.src))
    Score._instance = this
    return Score._instance
  }
}

abstract class Note {
  public x: number
  public sec: number
  public connection: ScoreNote | null

  constructor (note: ScoreNote) {
    this.sec = note.sec
    this.x = Score.X[note.finishPos - 1]
    // this.y = Score.TOP_TO_TARGET_POSITION - distance
    // this.y = -102
    this.connection = null
  }

  abstract draw (score: Score): void
}

class TapNote extends Note {
  constructor (note: ScoreNote) {
    super(note)
  }

  public draw (score: Score) {
    const distance = ~~(score.options.speed * 60 * (this.sec - score.audio.currentTime))
    const y = Score.TOP_TO_TARGET_POSITION - distance
    score.frontCtx.drawImage(tapCanvas, this.x, y)
  }
}

class FlipNote extends Note {
  private _status: number
  constructor (note: ScoreNote, connectionNote?: ScoreNote) {
    super(note)
    this._status = note.status
    if (this._status === 1) {
      this.x = this.x - 23
    }
    if (connectionNote) {
      this.connection = connectionNote
    }
  }

  public draw (score: Score) {
    const distance = ~~(score.options.speed * 60 * (this.sec - score.audio.currentTime))
    const y = Score.TOP_TO_TARGET_POSITION - distance

    if (this.connection) {
      const connectionX = Score.X[this.connection.finishPos - 1]
      const connectionY = Score.TOP_TO_TARGET_POSITION - (~~(score.options.speed * 60 * (this.connection.sec - score.audio.currentTime)))
      if (this.connection.type === 1 || (this.connection.type === 3 && this.connection.status !== 0)) {
        if (connectionY < Score.TOP_TO_TARGET_POSITION) {
          score.frontCtx.beginPath()
          score.frontCtx.moveTo(this._status === 1 ? this.x + 23 + 51 : this.x + 51, y)
          score.frontCtx.lineTo(this._status === 1 ? this.x + 23 + 51 : this.x + 51, y + 102)
          score.frontCtx.lineTo(connectionX + 51, connectionY + 102)
          score.frontCtx.lineTo(connectionX + 51, connectionY)
          score.frontCtx.lineTo(this._status === 1 ? this.x + 23 + 51 : this.x + 51, y)
          score.frontCtx.fill()
        }
      } else if (this.connection.type === 2) {
        score.frontCtx.beginPath()
        score.frontCtx.arc((this._status === 1 ? this.x + 23 : this.x) + 51, y + 51, 51, 0, Math.PI, true)
        const targetY = connectionY > Score.TOP_TO_TARGET_POSITION ? Score.TOP_TO_TARGET_POSITION + 51 : connectionY + 51
        score.frontCtx.lineTo(this._status === 1 ? this.x + 23 : this.x, targetY)
        score.frontCtx.arc((this._status === 1 ? this.x + 23 : this.x) + 51, targetY, 51, Math.PI, 2 * Math.PI, true)
        score.frontCtx.lineTo((this._status === 1 ? this.x + 23 : this.x) + 102, y + 51)
        score.frontCtx.fill()
      } else {
        score.frontCtx.beginPath()
        score.frontCtx.arc(this.x + 51, y + 51, 51, 0, Math.PI, true)
        const targetY = connectionY > Score.TOP_TO_TARGET_POSITION ? Score.TOP_TO_TARGET_POSITION + 51 : connectionY + 51
        const targetX = connectionY > Score.TOP_TO_TARGET_POSITION ? connectionX + ((this.x - connectionX) * (-(Score.TOP_TO_TARGET_POSITION - connectionY)) / ((-(Score.TOP_TO_TARGET_POSITION - connectionY)) + distance)) : connectionX
        score.frontCtx.lineTo(targetX, targetY)
        score.frontCtx.arc(targetX + 51, targetY, 51, Math.PI, 2 * Math.PI, true)
        score.frontCtx.lineTo(this.x + 102, y + 51)
        score.frontCtx.fill()
        if (connectionY > Score.TOP_TO_TARGET_POSITION) score.frontCtx.drawImage(longMoveWhiteCanvas, targetX, targetY - 51)
      }
    }
    score.frontCtx.drawImage(this._status === 1 ? flipLeftCanvas : flipRightCanvas, this.x, y)
  }
}

class LongNote extends Note {
  constructor (note: ScoreNote, connectionNote?: ScoreNote) {
    super(note)

    if (connectionNote) {
      this.connection = connectionNote
    }
  }

  public draw (score: Score) {
    const distance = ~~(score.options.speed * 60 * (this.sec - score.audio.currentTime))
    const y = Score.TOP_TO_TARGET_POSITION - distance
    if (this.connection) {
      const connectionY = Score.TOP_TO_TARGET_POSITION - (~~(score.options.speed * 60 * (this.connection.sec - score.audio.currentTime)))
      score.frontCtx.beginPath()
      score.frontCtx.arc(this.x + 51, y + 51, 51, 0, Math.PI, true)
      const targetY = connectionY > Score.TOP_TO_TARGET_POSITION ? Score.TOP_TO_TARGET_POSITION + 51 : connectionY + 51
      score.frontCtx.lineTo(this.x, targetY)
      score.frontCtx.arc(this.x + 51, targetY, 51, Math.PI, 2 * Math.PI, true)
      score.frontCtx.lineTo(this.x + 102, y + 51)
      score.frontCtx.fill()
    }
    score.frontCtx.drawImage(longLoopCanvas, this.x, y)
  }
}

class LongMoveNote extends Note {
  constructor (note: ScoreNote, connectionNote?: ScoreNote) {
    super(note)

    if (connectionNote) {
      this.connection = connectionNote
    }
  }

  public draw (score: Score) {
    const distance = ~~(score.options.speed * 60 * (this.sec - score.audio.currentTime))
    const y = Score.TOP_TO_TARGET_POSITION - distance
    if (this.connection) {
      const connectionX = Score.X[this.connection.finishPos - 1]
      const connectionY = Score.TOP_TO_TARGET_POSITION - (~~(score.options.speed * 60 * (this.connection.sec - score.audio.currentTime)))
      score.frontCtx.beginPath()
      score.frontCtx.arc(this.x + 51, y + 51, 51, 0, Math.PI, true)
      const targetY = connectionY > Score.TOP_TO_TARGET_POSITION ? Score.TOP_TO_TARGET_POSITION + 51 : connectionY + 51
      const targetX = connectionY > Score.TOP_TO_TARGET_POSITION ? connectionX + ((this.x - connectionX) * (-(Score.TOP_TO_TARGET_POSITION - connectionY)) / ((-(Score.TOP_TO_TARGET_POSITION - connectionY)) + distance)) : connectionX
      score.frontCtx.lineTo(targetX, targetY)
      score.frontCtx.arc(targetX + 51, targetY, 51, Math.PI, 2 * Math.PI, true)
      score.frontCtx.lineTo(this.x + 102, y + 51)
      score.frontCtx.fill()
      if (connectionY > Score.TOP_TO_TARGET_POSITION) score.frontCtx.drawImage(longMoveWhiteCanvas, targetX, targetY - 51)
    }
    score.frontCtx.drawImage(longMoveCanvas, this.x, y)
  }
}

window.addEventListener('beforeunload', () => {
  const mainwindow = remote.BrowserWindow.fromId(ipcRenderer.sendSync('mainWindowId'))
  mainwindow.webContents.send('liveEnd', null, false)
})

// ipcRenderer.once('start', (_e: Event, song: Song) => {
//   console.log(song)
//   let name = parsePath(song.src).name.split('-')[1]
//   document.getElementsByTagName('title')[0].innerHTML = name
//   const globalScore = Score.get(song)
//   globalScore.init()
//   globalScore.start()
// })

function createAudio (src: string) {
  const audio = new Audio(src)
  audio.preload = 'auto'
  return audio
}

function newImage (src: string) {
  let img = new Image()
  img.src = src
  return img
}

function main () {
  const song = ipcRenderer.sendSync('getSong')
  if (!song) return

  console.log(song)
  let name = parse(song.src).name.split('-')[1]
  document.getElementsByTagName('title')[0].innerHTML = name
  const globalScore = Score.get(song)
  globalScore.init()
  globalScore.start()
}

main()
