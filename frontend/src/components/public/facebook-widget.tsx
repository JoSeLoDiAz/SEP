'use client'

// Widget embebido de Facebook — Página oficial SENA
// Se carga como iframe del plugin oficial de Facebook
export function FacebookWidget() {
  return (
    <div className="w-full flex justify-center">
      <iframe
        src="https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2FSENA%2F%3Flocale%3Des_LA&tabs=timeline&width=500&height=600&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=false"
        width="500"
        height="600"
        style={{ border: 'none', overflow: 'hidden', maxWidth: '100%' }}
        scrolling="no"
        frameBorder={0}
        allowFullScreen
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        title="Facebook SENA"
        loading="lazy"
      />
    </div>
  )
}
