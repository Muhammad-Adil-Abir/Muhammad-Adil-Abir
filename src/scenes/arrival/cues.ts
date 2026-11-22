/**
 * The Arrival's beat sheet, in milliseconds. DOM typography, audio and the
 * WebGL scene all read these numbers so the sequence stays in sync.
 */
export const ARRIVAL = {
  reveal: 500, // darkness lifts, dust becomes visible
  backlight: 1500, // the light rises behind the figure
  visor: 3000, // the visor ignites
  riser: 2700, // audio build toward the event
  ignite: 4200, // the light event
  rise: 4350, // the figure rises from the landing
  letterbox: 4900, // letterbox bars retract
  kicker: 5000, // "WELCOME TO"
  title: 5450, // "ABIR'S WORLD."
  rule: 6500,
  supporting: 6900,
  tagline: 7250,
  controls: 7900,
  duration: 9000,
} as const;
