import { PHASES } from '../constants/phases'

export const READER_PAGE_MODES = Object.freeze({
  FOCUS_SEQUENCE: 'focus-sequence',
  FLOW: 'flow',
})

export const READER_TRANSITION_TYPES = Object.freeze({
  STANDARD: 'standard',
  CHAPTER_END: 'chapter-end',
})

function deepFreeze(value) {
  Object.values(value).forEach(child => {
    if (child && typeof child === 'object' && !Object.isFrozen(child)) deepFreeze(child)
  })
  return Object.freeze(value)
}

const paragraph = text => ({ type: 'paragraph', text })
const beat = (id, ...items) => {
  const sceneState = items[0] && typeof items[0] === 'object' ? items.shift() : null
  return {
    id,
    ...(sceneState ? { sceneState } : {}),
    blocks: items.map(paragraph),
  }
}

const page = ({ id, sceneId, sceneLabel, beats, transitionType, target, boundaryKind = 'continuous' }) => ({
  id,
  mode: READER_PAGE_MODES.FOCUS_SEQUENCE,
  supportedModes: [READER_PAGE_MODES.FOCUS_SEQUENCE, READER_PAGE_MODES.FLOW],
  scene: {
    id: sceneId,
    label: sceneLabel,
  },
  beats,
  transitionType,
  boundary: {
    kind: boundaryKind,
    transitionType,
    ...(target ? { target } : {}),
  },
})

export const readerContent = deepFreeze([
  {
    id: 'M1',
    title: '修杰·第一章',
    pages: [
      page({
        id: 'ancestral-home',
        sceneId: 'ancestral-home',
        sceneLabel: '姬家祖宅',
        transitionType: READER_TRANSITION_TYPES.STANDARD,
        target: { phaseId: 'M1', pageId: 'threshold-passage', beatIndex: 0 },
        boundaryKind: 'strong',
        beats: [
          beat('home-01', { light: 1, warm: 1, saturation: 1, vignette: 0.08, cool: 0, narrow: 0 }, '表世界的四月，上午十点。', '姬修杰站在祖宅的院子里，阳光穿过老槐树洒下一地碎影。风很轻，带着春天的花草味道。'),
          beat('home-02', { light: .97, warm: .92, saturation: .92, vignette: .1, cool: 0, narrow: 0 }, '手机屏幕上是三天前线人发来的消息，只有一句话：', '“陈副部长失踪了。”'),
          beat('home-03', { light: .95, warm: .84, saturation: .86, vignette: .12, cool: .03, narrow: .01 }, '陈副部长——里世界知情高层中级别最高的几位之一，任职二十三年来，几乎没有出过纰漏。'),
          beat('home-04', { light: .92, warm: .75, saturation: .79, vignette: .14, cool: .06, narrow: .02 }, '根据情报，陈副部长的失踪没有任何预兆，办公室原封未动。'),
          beat('home-04b', { light: .9, warm: .68, saturation: .72, vignette: .16, cool: .08, narrow: .04 }, '最后被人看到是在一次例行会议上，散会之后的第二天，就再也没有人见过陈副部长了。'),
          beat('home-05', { light: .87, warm: .56, saturation: .66, vignette: .19, cool: .12, narrow: .06 }, '人间蒸发。'),
          beat('home-06', { light: .84, warm: .5, saturation: .64, vignette: .21, cool: .14, narrow: .08 }, '姬修杰也没打算告诉爷爷。', '里世界那边没有通知姬家。'),
          beat('home-07', { light: .81, warm: .44, saturation: .62, vignette: .24, cool: .18, narrow: .1 }, '如果让爷爷知道，姬家的机器就会转起来——知情者会被控制，所有高层都会经历一波大洗牌。'),
          beat('home-07b', { light: .76, warm: .36, saturation: .59, vignette: .28, cool: .22, narrow: .15 }, '就好像什么事情也没有发生过一样。', '姬修杰不想打草惊蛇，同样，里世界的高层也不想丢了性命。'),
          beat('home-09', { light: .7, warm: .3, saturation: .56, vignette: .32, cool: .3, narrow: .2 }, '收起手机，穿过院子，走进正厅。', '光线一暗，供桌上三炷香早已经熄灭，只剩下三个根部伫立在香炉里。'),
          beat('home-10', { light: .63, warm: .24, saturation: .53, vignette: .38, cool: .4, narrow: .28 }, '供桌后面挂着姬家老祖宗的画像，画像背后是一扇暗门——通往里世界的通道入口。'),
          beat('home-11', { light: .58, warm: .18, saturation: .5, vignette: .44, cool: .5, narrow: .35 }, '姬修杰拿掉了旧的三炷香，点了三炷新香插进炉子，双手合了一下。'),
          beat('home-12', { light: .55, warm: .15, saturation: .49, vignette: .48, cool: .55, narrow: .39 }, '据说这样能保姬家人在里世界平安。他不信这个，但每次都做。'),
          beat('home-13', { light: .52, warm: .12, saturation: .47, vignette: .52, cool: .62, narrow: .44 }, '习惯也好，仪式感也好，通道那头的世界总让人觉得需要一点什么东西压一压。'),
        ],
      }),
      page({
        id: 'threshold-passage',
        sceneId: 'threshold-passage',
        sceneLabel: '暗门通道',
        transitionType: READER_TRANSITION_TYPES.STANDARD,
        target: { phaseId: 'M1', pageId: 'inner-street', beatIndex: 0 },
        beats: [
          beat('threshold-01', { light: .5, warm: .1, saturation: .45, vignette: .54, cool: .66, narrow: .46, sceneState: 'passage' }, '推开暗门，走进通道。'),
          beat('threshold-02', { light: .46, warm: .08, saturation: .43, vignette: .58, cool: .7, narrow: .5, sceneState: 'passage' }, '通道不长，十几步的距离。', '但每一步空气都在变冷，鼻腔里多出一股矿物味，表世界里没有的那种。'),
          beat('threshold-03', { light: .42, warm: .06, saturation: .41, vignette: .62, cool: .74, narrow: .54, sceneState: 'passage' }, '即使来过很多次，这股寒意还是会让他打个寒颤。'),
          beat('threshold-04', { light: .38, warm: .04, saturation: .39, vignette: .66, cool: .78, narrow: .58, sceneState: 'passage' }, '通道尽头是一扇旧木门。'),
          beat('threshold-05', { light: .35, warm: .02, saturation: .38, vignette: .69, cool: .82, narrow: .6, sceneState: 'white-threshold', boundaryVisual: 'white-flash' }, '门推开，白光扑面。'),
        ],
      }),
      page({
        id: 'inner-street',
        sceneId: 'inner-street',
        sceneLabel: '里世界街道',
        transitionType: READER_TRANSITION_TYPES.STANDARD,
        target: { phaseId: 'M1', pageId: 'commercial-street', beatIndex: 0 },
        beats: [
          beat('street-01', { light: .9, warm: 0, saturation: .52, vignette: .2, cool: .88, narrow: .08, sceneState: 'normal' }, '里世界。', '晴天第六天。'),
          beat('street-02', { light: .88, warm: 0, saturation: .5, vignette: .2, cool: .86, narrow: .06, sceneState: 'normal' }, '阳光比表世界亮，但不暖，是过分的白。', '建筑、行人、招牌，都被这层白盖住，颜色像被抽走了一半。'),
          beat('street-03', { light: .87, warm: 0, saturation: .5, vignette: .19, cool: .84, narrow: .05, sceneState: 'normal' }, '街道和表世界几乎一模一样，连两侧建筑的高度都对得上。', '不同的是店铺的名字、路上的人，还有空气里的味道。'),
          beat('street-04', { light: .86, warm: 0, saturation: .49, vignette: .18, cool: .82, narrow: .04, sceneState: 'normal' }, '表世界的四月有花香和草坪的气息，里世界只有那股金属味，洗不掉。'),
          beat('street-05', { light: .86, warm: 0, saturation: .5, vignette: .18, cool: .8, narrow: .03, sceneState: 'normal' }, '明天是晴天最后一天，后天转雨，连下七天。', '街上的人比平时多不少，趁着最后的好天气出来采购、散步、消磨时间。'),
          beat('street-06', { light: .85, warm: 0, saturation: .5, vignette: .18, cool: .78, narrow: .02, sceneState: 'normal' }, '里世界的人对这个节奏习以为常——七天晴，七天雨，从记事起就是如此，没人觉得奇怪。'),
          beat('street-07', { light: .84, warm: 0, saturation: .51, vignette: .18, cool: .76, narrow: .02, sceneState: 'normal' }, '姬修杰掏出手机叫了辆车，目的地设在咖啡馆附近。'),
        ],
      }),
      page({
        id: 'commercial-street',
        sceneId: 'commercial-street',
        sceneLabel: '商业街',
        transitionType: READER_TRANSITION_TYPES.STANDARD,
        target: { phaseId: 'M1', pageId: 'crowd-corner', beatIndex: 0 },
        beats: [
          beat('commercial-01', { sceneState: 'normal' }, '商业街到了。他下车，顺着人流往拐角走。', '这条街他在表世界也常来，同样的位置也开着一家咖啡馆，他很喜欢。'),
          beat('commercial-02', { sceneState: 'normal' }, '里世界这边装潢几乎一样，但咖啡的味道不对——豆子里有股矿物质的底味，他喝了好几次也没习惯。', '今天是周六，街上挤得很。'),
          beat('commercial-03', { sceneState: 'normal' }, '姬修杰低着头快步走，脑子里过着老周那条消息。', '陈副部长的失踪太干净了——没有预兆，没有挣扎，没有痕迹。'),
          beat('commercial-04', { sceneState: 'normal' }, '会议结束，人就没了。', '这不像是一个人自己能做到的事情。'),
          beat('commercial-05', { sceneState: 'recognition' }, '抬头的一瞬间，他看见了一张脸。'),
          beat('commercial-06', { sceneState: 'recognition' }, '人流里一闪而过。', '长发，白裙，半张侧脸从发丝的缝隙里露出来——那张脸，他这辈子都不会认错。'),
          beat('commercial-07', { sceneState: 'recognition' }, '他停下脚步。', '不可能。'),
          beat('commercial-08', { sceneState: 'recognition' }, '五年了。', '他从来没有在街上遇到过哪怕一次接近——没有相似的侧脸，没有相似的步态。一次都没有。'),
          beat('commercial-09', { sceneState: 'recognition' }, '所以这次——一定是他自己看错了。', '是脑子里那张脸太熟，借着别人的侧脸叠了上去。'),
          beat('commercial-10', { sceneState: 'signalHeat' }, '他正要让自己转头继续走——', '胸口突然一热。'),
          beat('commercial-11', { sceneState: 'signalHeat' }, '白色信物在衣服下面发光了——隔着衬衫看不出来，但他感觉到了。', '是温的，从胸骨那里透出来。'),
          beat('commercial-12', { sceneState: 'signalHeat' }, '他抬手按住胸口，摸到信物的轮廓——还在原来的位置，没动，但确实在发热。'),
          beat('commercial-13', { sceneState: 'signalHeat' }, '五年来第一次。', '两个信物靠得足够近时才会有这个反应。'),
          beat('commercial-14', { sceneState: 'signalHeat' }, '也就是说——刚才那张脸，不是他脑子借的。'),
          beat('chase-01', { light: .8, vignette: .3, sceneState: 'chase' }, '周围的声音突然远了，又一齐拥回来。'),
          beat('chase-02', { light: .8, vignette: .3, sceneState: 'chase' }, '五年里几个画面无序地闪过——', '祖宅院子里她蹲在地上看蚂蚁、她把信物从他手里抢回去说这是她的、她最后一次回头朝他笑——'),
          beat('chase-03', { light: .8, vignette: .3, sceneState: 'chase' }, '他抓回了自己。', '而现在，人就在前面。'),
          beat('chase-04', { light: .8, vignette: .3, sceneState: 'chase' }, '他压住心跳，开始加速穿行。', '人太多了。', '那个白色的背影在人流中忽隐忽现，越来越远。'),
          beat('chase-05', { light: .8, vignette: .3, sceneState: 'chase' }, '他开始跑。'),
        ],
      }),
      page({
        id: 'crowd-corner',
        sceneId: 'commercial-street',
        sceneLabel: '商业街',
        transitionType: READER_TRANSITION_TYPES.CHAPTER_END,
        beats: [
          beat('corner-01', { light: .8, vignette: .3, sceneState: 'chase' }, '挤开身前的路人，绕过一群站在路中间拍照的年轻人，差点撞上一个推婴儿车的女人——'),
          beat('corner-02', { sceneState: 'aftermath' }, '等他冲到她刚才的位置，什么都没有了。'),
          beat('corner-03', { sceneState: 'aftermath' }, '街道还是那条街道，人群还在流动，阳光还是那种过分的白。', '她消失了，干干净净。'),
          beat('corner-04', { sceneState: 'aftermath' }, '姬修杰站在原地，胸口的信物还有余温，正在冷下去。', '他环顾四周。', '每张脸都是陌生人的脸。'),
          beat('corner-05', { sceneState: 'aftermath' }, '她确实在这里。', '信物不会骗人。'),
          beat('corner-06', { sceneState: 'aftermath' }, '他很想继续找。', '但人山人海，找不到的。', '老周还在咖啡馆等他。陈副部长的事还没有着落。'),
          beat('corner-07', { sceneState: 'aftermath' }, '他深吸一口气，转身朝咖啡馆走去。', '走了几步，还是忍不住回头看了一眼。'),
          beat('corner-08', { sceneState: 'aftermath' }, '什么都没有。'),
        ],
      }),
    ],
  },
])

export function validateReaderContent(content) {
  if (!Array.isArray(content) || content.length === 0) throw new TypeError('Reader content must be a non-empty array of phases')
  const phaseIds = new Set()
  const pageIds = new Set()
  const beatIds = new Set()
  for (const phase of content) {
    if (!phase || typeof phase.id !== 'string' || !PHASES.includes(phase.id)) throw new Error(`Invalid phase ID: ${String(phase?.id)}`)
    if (phaseIds.has(phase.id)) throw new Error(`Duplicate phase ID: ${phase.id}`)
    phaseIds.add(phase.id)
    if (!Array.isArray(phase.pages) || phase.pages.length === 0) throw new Error(`Phase ${phase.id} must provide pages`)
    for (const currentPage of phase.pages) {
      if (!currentPage?.id) throw new Error(`Invalid page ID in phase ${phase.id}`)
      if (pageIds.has(currentPage.id)) throw new Error(`Duplicate page ID: ${currentPage.id}`)
      pageIds.add(currentPage.id)
      if (!Object.values(READER_PAGE_MODES).includes(currentPage.mode)) throw new Error(`Invalid page mode: ${String(currentPage.mode)}`)
      if (!Array.isArray(currentPage.beats) || currentPage.beats.length === 0) throw new Error(`Empty page: ${currentPage.id}`)
      if (!currentPage.scene?.label || !currentPage.boundary || !currentPage.transitionType) throw new Error(`Incomplete page configuration: ${currentPage.id}`)
      for (const currentBeat of currentPage.beats) {
        if (!currentBeat?.id) throw new Error(`Invalid beat ID in page ${currentPage.id}`)
        if (beatIds.has(currentBeat.id)) throw new Error(`Duplicate beat ID: ${currentBeat.id}`)
        beatIds.add(currentBeat.id)
      }
    }
  }
  return content
}

validateReaderContent(readerContent)
