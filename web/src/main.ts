import './styles.css'
import { renderCompare } from './views/compare.js'
import { renderImport } from './views/import.js'
import { renderRecommend } from './views/recommend.js'

function route(): void {
  const hash = window.location.hash || '#/compare'
  const app = document.getElementById('app')!

  // highlight active nav link
  document.querySelectorAll('nav a').forEach((a) => {
    const el = a as HTMLAnchorElement
    el.classList.toggle('active', el.getAttribute('href') === hash)
  })

  if (hash.startsWith('#/compare')) {
    renderCompare(app)
  } else if (hash.startsWith('#/import')) {
    renderImport(app)
  } else if (hash.startsWith('#/recommend')) {
    renderRecommend(app)
  } else {
    app.innerHTML = '<p>Unknown route.</p>'
  }
}

window.addEventListener('hashchange', route)
route()
