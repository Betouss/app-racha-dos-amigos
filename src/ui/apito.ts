// Apito de árbitro sintetizado com Web Audio: funciona offline, sem arquivo de som.

let ctx: AudioContext | undefined

function contexto(): AudioContext | undefined {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return undefined
    ctx = new AC()
  }
  return ctx
}

/**
 * Navegadores só liberam áudio depois de um gesto do usuário. Destrava o
 * contexto no primeiro toque em qualquer lugar, para o apito poder tocar
 * sozinho quando o tempo acabar.
 */
export function destravarAudio() {
  const destravar = () => {
    const c = contexto()
    if (c && c.state === 'suspended') c.resume().catch(() => {})
  }
  window.addEventListener('pointerdown', destravar, { passive: true })
  window.addEventListener('keydown', destravar)
}

/** Um silvo: tom agudo com trinado rápido, como a bolinha do apito. */
function silvo(c: AudioContext, inicio: number, duracao: number) {
  const osc = c.createOscillator()
  osc.type = 'triangle'
  osc.frequency.value = 2900

  // trinado: modula frequência e volume ~28 vezes por segundo
  const trinado = c.createOscillator()
  trinado.frequency.value = 28
  const profFreq = c.createGain()
  profFreq.gain.value = 180
  trinado.connect(profFreq).connect(osc.frequency)

  const volume = c.createGain()
  volume.gain.setValueAtTime(0, inicio)
  volume.gain.linearRampToValueAtTime(0.5, inicio + 0.02)
  volume.gain.setValueAtTime(0.5, inicio + duracao - 0.04)
  volume.gain.linearRampToValueAtTime(0, inicio + duracao)

  const tremolo = c.createGain()
  tremolo.gain.value = 0.75
  const profVol = c.createGain()
  profVol.gain.value = 0.25
  trinado.connect(profVol).connect(tremolo.gain)

  osc.connect(tremolo).connect(volume).connect(c.destination)
  osc.start(inicio)
  trinado.start(inicio)
  osc.stop(inicio + duracao)
  trinado.stop(inicio + duracao)
}

/** Fim de jogo: dois apitos curtos e um longo. */
export async function apitarFim() {
  const c = contexto()
  if (!c) return
  if (c.state === 'suspended') await c.resume().catch(() => {})
  const t = c.currentTime + 0.05
  silvo(c, t, 0.35)
  silvo(c, t + 0.5, 0.35)
  silvo(c, t + 1.0, 1.1)
}
