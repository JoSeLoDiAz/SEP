'use client'

// Widget de Instagram — @natalia_grajales_dsnft
export function InstagramWidget() {
  return (
    <div className="w-full flex justify-center">
      <iframe
        src="https://www.instagram.com/natalia_grajales_dsnft/embed"
        width="500"
        height="600"
        style={{ border: 'none', overflow: 'hidden', maxWidth: '100%', background: '#fff' }}
        scrolling="no"
        frameBorder={0}
        allowFullScreen
        title="Instagram DSNFT"
        loading="lazy"
      />
    </div>
  )
}
