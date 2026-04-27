// Filtros SVG con matrices feColorMatrix para simular daltonismo.
// Valores comunes: https://github.com/MaPePeR/jsColorblindSimulator
export function ColorblindFilters() {
  return (
    <svg
      aria-hidden="true"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      <defs>
        <filter id="cb-deuteranopia">
          <feColorMatrix
            type="matrix"
            values="0.625 0.375 0     0 0
                    0.700 0.300 0     0 0
                    0     0.300 0.700 0 0
                    0     0     0     1 0"
          />
        </filter>
        <filter id="cb-protanopia">
          <feColorMatrix
            type="matrix"
            values="0.567 0.433 0     0 0
                    0.558 0.442 0     0 0
                    0     0.242 0.758 0 0
                    0     0     0     1 0"
          />
        </filter>
        <filter id="cb-tritanopia">
          <feColorMatrix
            type="matrix"
            values="0.950 0.050 0     0 0
                    0     0.433 0.567 0 0
                    0     0.475 0.525 0 0
                    0     0     0     1 0"
          />
        </filter>
      </defs>
    </svg>
  )
}
