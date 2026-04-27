'use client'

// Skip link estándar WCAG: invisible hasta que recibe focus (Tab desde
// el inicio). Permite a usuarios de teclado saltarse header/sidebar y
// caer directamente en el contenido principal de la página.
export function SkipLink() {
  function jump(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault()
    const target =
      document.querySelector<HTMLElement>('main') ||
      document.querySelector<HTMLElement>('h1') ||
      document.body
    if (!target.hasAttribute('tabindex')) target.tabIndex = -1
    target.focus({ preventScroll: false })
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <a
      href="#main-content"
      onClick={jump}
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[80] focus:bg-[#00304D] focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:shadow-lg"
    >
      Saltar al contenido principal
    </a>
  )
}
