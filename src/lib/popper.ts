import Popper from 'popper.js'
import '../styles/popper.css'

export class PopperManager {
  protected activePopper?: Popper
  protected container?: HTMLElement

  public show(
    target: Element,
    contents: HTMLElement,
    placement: Popper.Placement = 'bottom',
    showArrow: boolean = true
  ) {
    if (this.activePopper) {
      return this.destroy()
    }

    window.requestAnimationFrame(() => {
      this.container = document.createElement('div')
      this.container.className = 'popper'

      const modifiers: Popper.Modifiers = {}

      if (showArrow) {
        const arrow = document.createElement('div')
        arrow.className = 'popper-arrow'
        this.container.appendChild(arrow)

        modifiers.arrow = {
          element: arrow,
        }
      } else {
        modifiers.arrow = {
          enabled: false,
        }
      }

      this.container.appendChild(contents)
      document.body.appendChild(this.container)

      this.activePopper = new Popper(target, this.container, {
        placement,
        removeOnDestroy: true,
        modifiers,
      })
    })
  }

  public destroy() {
    if (this.activePopper) {
      this.activePopper.destroy()
      delete this.activePopper
    }
  }

  public update() {
    if (this.activePopper) {
      this.activePopper.update()
    }
  }
}
