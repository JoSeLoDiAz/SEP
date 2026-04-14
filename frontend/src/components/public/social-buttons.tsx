'use client'

import { Facebook, Instagram, XIcon, Youtube } from 'lucide-react'

// Redes del programa GPC-SENA (FCE / GPC)
const socialLinks = [
  {
    icon: Facebook,
    label: 'Facebook',
    href: 'https://www.facebook.com/people/Rusby-Vargas-fce/100063727045079/',
  },
  {
    icon: XIcon,
    label: 'X',
    href: 'https://x.com/RusbyVargas',
  },
  {
    // Google/Gmail icon — lucide no tiene, usamos Mail like envelope
    icon: null,
    label: 'Correo',
    href: 'mailto:gfce@sena.edu.co',
    letter: 'G',
  },
  {
    icon: Instagram,
    label: 'Instagram',
    href: 'https://www.instagram.com/rusbyvargasfce/',
  },
  {
    icon: Youtube,
    label: 'YouTube',
    href: 'https://www.youtube.com/@PFCE-SENA',
  },
]

export function SocialButtons() {
  return (
    <div className="flex flex-wrap justify-center gap-4">
      {socialLinks.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target={link.href.startsWith('mailto') ? undefined : '_blank'}
          rel="noopener noreferrer"
          title={link.label}
          className="
            w-[90px] h-[90px] rounded-[30%]
            bg-cerulean-500 text-white
            flex items-center justify-center
            text-[28px] shadow-md
            transition-all duration-300 ease-in-out
            hover:bg-lime-500 hover:shadow-lg hover:scale-110
          "
        >
          {link.icon ? (
            <link.icon size={32} strokeWidth={1.5} />
          ) : (
            <span className="font-bold text-2xl">{link.letter}</span>
          )}
        </a>
      ))}
    </div>
  )
}
