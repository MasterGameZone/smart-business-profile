import { useEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react'

interface ScrollRevealProps {
  children: ReactNode
  className?: string
  delayMs?: number
}

function ScrollReveal({ children, className = '', delayMs = 0 }: ScrollRevealProps): ReactElement {
  const [isVisible, setIsVisible] = useState(false)
  const elementRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const element = elementRef.current

    if (!element) {
      return
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return
          }

          setIsVisible(true)
          observer.unobserve(entry.target)
        })
      },
      {
        threshold: 0.16,
        rootMargin: '0px 0px -8% 0px',
      }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [])

  const revealStyle: CSSProperties & { '--landing-reveal-delay': string } = {
    '--landing-reveal-delay': `${delayMs}ms`,
  }

  return (
    <div
      ref={elementRef}
      className={`landing-reveal${isVisible ? ' landing-reveal-visible' : ''}${className ? ` ${className}` : ''}`}
      style={revealStyle}
    >
      {children}
    </div>
  )
}

export default ScrollReveal
