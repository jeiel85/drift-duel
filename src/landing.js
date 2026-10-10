// The live demo is an iframe of the game. It loads on demand so the landing page
// stays light on phones (and does not grab touch scrolling until asked).
const screen = document.querySelector('#demo .screen');
const startBtn = document.querySelector('#demo-start');

function loadDemo() {
  const frame = document.createElement('iframe');
  frame.src = './play.html?embed=1';
  frame.title = 'Drift Duel 라이브 데모';
  frame.allow = 'autoplay; fullscreen; gamepad';
  screen.replaceChildren(frame);
  frame.focus();
}

startBtn.addEventListener('click', loadDemo);

// Desktop visitors see the demo running right away.
if (window.matchMedia('(pointer: fine) and (min-width: 900px)').matches) loadDemo();
