import { Scene } from 'phaser'

export class Boot extends Scene {
  constructor() {
    super('Boot')
  }

  preload() {
    // Load minimal assets required by the Preloader scene
  }

  create() {
    this.scene.start('Preloader')
  }
}
