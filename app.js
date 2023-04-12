const startRecordingButton = document.getElementById('startRecording')
const resultDiv = document.getElementById('result')

let mediaRecorder
let audioChunks = []

let audioContext
let mediaStreamSource
let scriptProcessorNode
let silenceStart
const silenceDuration = 3000 // 3 seconds
const whisperEndpoint = 'https://whisper.voiceflow.studio/api/speech-to-text'

async function init() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    audioContext = new AudioContext()
    mediaStreamSource = audioContext.createMediaStreamSource(stream)
    scriptProcessorNode = audioContext.createScriptProcessor(4096, 1, 1)

    scriptProcessorNode.onaudioprocess = function (event) {
      const inputBuffer = event.inputBuffer.getChannelData(0)
      checkForSilence(inputBuffer)
    }

    mediaStreamSource.connect(scriptProcessorNode)
    scriptProcessorNode.connect(audioContext.destination)

    mediaRecorder = new MediaRecorder(stream)
    mediaRecorder.addEventListener('dataavailable', (event) => {
      audioChunks.push(event.data)
    })

    mediaRecorder.addEventListener('stop', async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/mpeg' })
      audioChunks = []

      const { text, elapsedTime } = await sendToWhisperAPI(audioBlob)
      resultDiv.innerHTML = `
      <p>${text}</p>
      ${elapsedTime ? `<small>Rendered in ${elapsedTime} seconds</small>` : ''}
    `
    })

    startRecordingButton.addEventListener('click', () => {
      // Clear the previous result when the button is clicked
      resultDiv.textContent = ''

      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop()
        startRecordingButton.textContent = 'Start Recording'
      } else {
        mediaRecorder.start()
        silenceStart = Date.now()
        startRecordingButton.textContent = 'Stop Recording'
      }
    })
  } catch (err) {
    console.error('Error initializing media recorder:', err)
    alert('Failed to get access to the microphone.')
  }
}

function checkForSilence(inputBuffer) {
  const isSilent = isBufferSilent(inputBuffer)
  if (isSilent) {
    if (Date.now() - silenceStart > silenceDuration) {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop()
        startRecordingButton.textContent = 'Start Recording'
      }
    }
  } else {
    silenceStart = Date.now()
  }
}

function isBufferSilent(buffer) {
  const threshold = 0.02
  for (let i = 0; i < buffer.length; i++) {
    if (Math.abs(buffer[i]) > threshold) {
      return false
    }
  }
  return true
}

async function sendToWhisperAPI(audioBlob) {
  /* Using OpenAI Whisper API */
  /*
  // Replace with your OpenAI API key and endpoint
  const apiKey = 'sk-'
  const apiUrl = 'https://api.openai.com/v1/audio/transcriptions'

  const formData = new FormData()
  formData.append('model', 'whisper-1')
  formData.append('file', audioBlob, 'audio.mp3')

  const startTime = performance.now();

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  })
  */

  /* Using custom Whisper API instance */

  const arrayBuffer = await audioBlob.arrayBuffer()
  const startTime = performance.now()
  const response = await fetch(whisperEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'audio/mpeg' },
    body: arrayBuffer,
  })

  const endTime = performance.now()
  const elapsedTime = ((endTime - startTime) / 1000).toFixed(2)

  if (response.ok) {
    const data = await response.json()
    return { text: data.text, elapsedTime }
  } else {
    console.error('Error sending audio to Whisper API:', response)
    alert('Failed to send audio to Whisper API.')
    return 'Error: Failed to convert speech to text.'
  }
}

init()
