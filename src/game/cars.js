// Car specs. Speeds in m/s, accelerations in m/s², rates in rad/s.
//   grip       lateral grip while gripping (higher = less sliding)
//   driftGrip  lateral grip while drifting (lower = longer slides)
//   turnRate   max yaw rate at full steer
//   driftTurn  yaw multiplier while drifting (oversteer)
//   nitroGain  how fast drifting refills the nitro meter

export const CARS = [
  {
    id: 'vela',
    name: 'Vela GT',
    class: 'Street',
    color: 0x2f80ff,
    accent: 0xffffff,
    maxSpeed: 42,
    accel: 17,
    brake: 30,
    drag: 0.02,
    grip: 10,
    driftGrip: 1.8,
    turnRate: 1.7,
    driftTurn: 1.25,
    steerSpeed: 5,
    nitroGain: 1,
    unlock: null,
  },
  {
    id: 'bruiser',
    name: 'Bruiser V8',
    class: 'Muscle',
    color: 0xe63946,
    accent: 0x111111,
    maxSpeed: 46,
    accel: 15,
    brake: 26,
    drag: 0.02,
    grip: 8.5,
    driftGrip: 1.4,
    turnRate: 1.55,
    driftTurn: 1.3,
    steerSpeed: 4.5,
    nitroGain: 1.15,
    unlock: null,
  },
  {
    id: 'dune',
    name: 'Dune Rally',
    class: 'Off-Road',
    color: 0xf4a261,
    accent: 0x264653,
    maxSpeed: 39,
    accel: 20,
    brake: 32,
    drag: 0.02,
    grip: 12,
    driftGrip: 2.4,
    turnRate: 1.85,
    driftTurn: 1.2,
    steerSpeed: 5.5,
    nitroGain: 0.9,
    unlock: null,
  },
  {
    id: 'zenith',
    name: 'Zenith R',
    class: 'Super',
    color: 0xb4ff39,
    accent: 0x111111,
    maxSpeed: 49,
    accel: 19,
    brake: 34,
    drag: 0.02,
    grip: 10,
    driftGrip: 1.5,
    turnRate: 1.7,
    driftTurn: 1.3,
    steerSpeed: 5.5,
    nitroGain: 0.85,
    // Unlocked by winning any race on Hard.
    unlock: 'win-hard',
  },
];

export const carById = (id) => CARS.find((c) => c.id === id) ?? CARS[0];
