const ctracker = new clm.tracker()
ctracker.init()

let loopFunction = () => {}
function loop() {
	loopFunction()
	requestAnimationFrame(loop)
}
loop()

Vue.component('camera-canvas', {
	props: { stream: MediaStream },
	data: function () {
		return { scale: 1 }
	},
	watch: {
		immediate: true,
		stream: function (stream) {
			if (stream) {
				const { canvas, video } = this.$refs
				video.srcObject = stream

				setupCanvas = (width, height) => {
					video.setAttribute('width', `${width}`)
					video.setAttribute('height', `${height}`)

					canvas.setAttribute('width', `${width}`)
					canvas.setAttribute('height', `${height}`)
					canvas.width = width
					canvas.height = height
					this.stretchCanvas()

					ctracker.stop()
					ctracker.reset()
					ctracker.start(video)

					const canvasContext = canvas.getContext('2d')

					loopFunction = () => {
						const positions = ctracker.getCurrentPosition()

						if (!positions) {
							return
						}

						canvasContext.save()

						canvasContext.strokeStyle = '#000000'
						canvasContext.fillStyle = '#000000'

						canvasContext.beginPath()
						canvasContext.rect(0, 0, width, height)
						canvasContext.fill()

						const chin = positions[7]
						const leftCheek = positions[0]
						const rightCheek = positions[14]
						const center = [
							leftCheek[0] + (rightCheek[0] - leftCheek[0]) / 2,
							leftCheek[1] + (rightCheek[1] - leftCheek[1]) / 2,
						]
						const radiusX = Math.sqrt(
							Math.pow(center[0] - chin[0], 2) +
								Math.pow(center[1] - chin[1], 2),
						)
						const radiusY = Math.sqrt(
							Math.pow(center[0] - leftCheek[0], 2) +
								Math.pow(center[1] - leftCheek[1], 2),
						)
						const angle = Math.atan2(chin[1] - center[1], chin[0] - center[0])

						canvasContext.beginPath()
						canvasContext.ellipse(
							center[0],
							center[1],
							radiusX * 0.8,
							radiusY,
							angle,
							0,
							Math.PI * 2,
						)
						canvasContext.globalCompositeOperation = 'destination-out'
						canvasContext.filter = 'blur(30px)'
						canvasContext.closePath()
						canvasContext.lineWidth = 150
						canvasContext.stroke()
						canvasContext.fill()

						canvasContext.filter = 'blur(2px)'
						canvasContext.globalCompositeOperation = 'source-over'
						const leftEye = [
							positions[23],
							positions[63],
							positions[24],
							positions[64],
							positions[25],
							positions[65],
							positions[26],
							positions[66],
						]

						const rightEye = [
							positions[30],
							positions[68],
							positions[29],
							positions[67],
							positions[28],
							positions[70],
							positions[31],
							positions[69],
						]

						const mouth = [
							positions[44],
							positions[45],
							positions[46],
							positions[47],
							positions[48],
							positions[49],
							positions[50],
							positions[51],
							positions[52],
							positions[53],
							positions[54],
							positions[55],
						]

						;[leftEye, rightEye, mouth].forEach((part, partI) => {
							canvasContext.beginPath()
							part.forEach((point, i) => {
								if (i === 0) {
									canvasContext.moveTo(point[0], point[1])
								} else {
									canvasContext.lineTo(point[0], point[1])
								}
							})
							canvasContext.closePath()
							canvasContext.lineWidth = partI < 2 ? 5 : 0
							canvasContext.fill()
							canvasContext.stroke()
						})
						canvasContext.globalCompositeOperation = 'xor'

						canvasContext.filter = 'blur(7px)'
						canvasContext.drawImage(video, 0, 0, width, height)

						canvasContext.filter = 'none'

						canvasContext.globalCompositeOperation = 'destination-over'
						canvasContext.drawImage(video, 0, 0, width, height)

						canvasContext.restore()
					}
				}

				const { width } = stream.getVideoTracks()[0].getSettings()
				video.setAttribute('width', `${width}`)
				video.addEventListener('loadedmetadata', function (event) {
					setupCanvas(this.videoWidth, this.videoHeight)
				})
			} else {
				loopFunction = () => {}
			}
		},
	},
	mounted: function () {
		window.addEventListener('resize', this.stretchCanvas)
		this.stretchCanvas()
	},
	methods: {
		stretchCanvas: function () {
			const { canvas } = this.$refs
			const { clientWidth, clientHeight } = canvas
			const { innerWidth, innerHeight } = window
			const canvasAspectRatio = clientWidth / clientHeight
			const windowAspectRatio = innerWidth / innerHeight
			this.scale =
				canvasAspectRatio > windowAspectRatio
					? innerHeight / clientHeight
					: innerWidth / clientWidth
		},
	},
	computed: {
		cssVars() {
			return {
				'--scale': this.scale,
			}
		},
	},
	template: `
		<div class="player" :style="cssVars">
			<video ref="video" preload="auto" loop playsinline autoplay></video>
			<canvas ref="canvas"></canvas>
		</div>
	`,
})

Vue.component('camera-picker', {
	data: function () {
		return {
			selected: 0,
			loading: true,
			options: [],
		}
	},
	methods: {
		async onChange(event) {
			const deviceId = event.target.value
			let stream = null
			if (deviceId) {
				stream = await navigator.mediaDevices.getUserMedia({
					video: {
						deviceId,
					},
				})
			}
			this.$emit('stream-change', stream)
		},
	},
	mounted: async function () {
		const cameraPermission = await navigator.permissions.query({
			name: 'camera',
		})
		if (cameraPermission.state === 'denied') {
			alert('Přístup ke kameře odepřen.')
			throw new Error('Video permission denied.')
		} else if (cameraPermission.state === 'prompt') {
			await navigator.mediaDevices.getUserMedia({ video: true })
		}
		const devices = await navigator.mediaDevices.enumerateDevices()
		this.loading = false
		devices.forEach((device) => {
			if (device.kind === 'videoinput') {
				this.options.push({
					id: device.deviceId,
					label: device.label || device.deviceId,
				})
			}
		})
	},
	template: `
		<select @change="onChange($event)" :disabled="loading">
			<option value="">{{loading ? 'Načítání' : 'Vyber kameru'}}</option>
			<option v-for="option in options" v-bind:value="option.id">{{ option.label }}</option>
		</select>`,
})

Vue.component('camera-app', {
	data: function () {
		return {
			stream: null,
		}
	},
	methods: {
		streamChange(stream) {
			this.stream = stream
		},
	},
	template: `
		<div v-bind:class="{app: true, 'is-cameraSelected': stream}">
			<camera-canvas v-bind:stream="stream"></camera-canvas>
			<camera-picker @stream-change="streamChange"></camera-picker>
		</div>
	`,
})

const app = new Vue({
	el: '#app',
})
