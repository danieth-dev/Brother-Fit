/* Router por hash:  #/progress/3  ->  vista "progress" con params ['3'].
 * Cada vista recibe un <section> nuevo (sus listeners y temporizadores se descartan con él). */
import * as home from './views/home.js';
import * as workout from './views/workout.js';
import * as history from './views/history.js';
import * as progress from './views/progress.js';
import * as creatine from './views/creatine.js';
import * as settings from './views/settings.js';
import * as appearance from './views/appearance.js';
import * as agent from './views/agent.js';
import * as meals from './views/meals.js';
import { esc } from './utils/dom.js';

const routes = { '': home, workout, history, progress, creatine, settings, appearance, agent, meals };
const tabOf = { history: '', creatine: '', settings: '', appearance: '', meals: '', agent: 'workout' };
let token = 0;

export async function renderRoute() {
  const [name = '', ...params] = location.hash.replace(/^#\/?/, '').split('/');
  const view = routes[name] || home;
  const mine = ++token;

  const section = document.createElement('section');
  section.className = 'view';
  try {
    await view.render(section, params);
  } catch (err) {
    console.error(err);
    section.innerHTML = `<p class="error">Algo salió mal: ${esc(err.message)}</p>`;
  }
  if (mine !== token) return; // el usuario ya navegó a otra pantalla

  document.getElementById('app').replaceChildren(section);
  window.scrollTo(0, 0);
  document.body.classList.toggle('in-agent-view', name === 'agent');
  const active = routes[name] ? (tabOf[name] ?? name) : '';
  document.querySelectorAll('.tabbar a').forEach((a) => {
    if (a.dataset.tab === active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

export function startRouter() {
  window.addEventListener('hashchange', renderRoute);
  return renderRoute();
}
