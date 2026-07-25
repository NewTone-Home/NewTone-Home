import Phaser from 'phaser'
import { CENTER_SCENE_KEY, CenterScene, type CenterSceneData } from './CenterScene'
import type {
  CenterLaunchRequest,
  CenterRuntimeInstance,
  CenterRuntimeLauncher,
} from './types'

/**
 * Session 与 Phaser 之间唯一的适配层。
 * 这里不做任何生命周期判断，只把 Session 的决定翻译成 Phaser 调用。
 */
export class PhaserCenterLauncher implements CenterRuntimeLauncher {
  launch(request: CenterLaunchRequest): CenterRuntimeInstance {
    const sceneData: CenterSceneData = {
      owner: request.owner,
      generation: request.generation,
      definition: request.definition,
      assetUrls: request.assetUrls,
    }

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: request.parent,
      width: Math.max(1, request.parent.clientWidth),
      height: Math.max(1, request.parent.clientHeight),
      transparent: true,
      render: { antialias: true, roundPixels: false },
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [],
      callbacks: {
        postBoot: instance => {
          // boot 是异步的：这段回调可能在 session 已经 stop 之后才执行。
          if (!request.shouldStartScene(request.generation)) return
          instance.scene.add(CENTER_SCENE_KEY, CenterScene, true, sceneData)
        },
      },
    })

    return {
      destroy: () => game.destroy(true),
    }
  }
}

export const phaserCenterLauncher = new PhaserCenterLauncher()
