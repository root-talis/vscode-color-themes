const { register } = require('./suggest.js');

register({
  name: 'rust',
  slots: [
    { name: 'string', families: ['green', 'yellow'], factor: 1.0, floor: 3.5, requirePaletteSlot: true },
    { name: 'macro', families: ['purple', 'pink'], factor: 1.0, floor: 3.5 },
    { name: 'consuming', families: ['red'], factor: 1.0, floor: 3.5 },
    { name: 'const', families: ['yellow', 'orange'], factor: 1.0, floor: 3.5 },
    { name: 'method', families: ['blue', 'cyan'], factor: 1.0, floor: 3.5 },
    { name: 'docComment', strategy: 'least-common-hue', factor: 0.75, floor: 3.0, distinctFrom: 'fg-muted' },
  ],
});
