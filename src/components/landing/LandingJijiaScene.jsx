import './LandingJijiaScene.css'

/**
 * 姬家大院 —— 纯代码场景原型（Phase 0.5 视觉验证）。
 *
 * 不是建筑图、不是插画、不是地图。是「有人站在院子里，把这座老宅记下来」。
 *
 * 三条让它不变成立面图的规矩：
 * 1. 视点偏左，右厢房朝观看者斜着退过来 —— 有了这一笔才有院子，没有它就是舞台布景。
 * 2. 正房明间正好空在中央，NewTone 挂在匾额的位置上。
 * 3. 老槐树在画外，只画伸进来的枝子和一地碎影。
 *
 * 景深靠笔触深浅拉开（远 0.07 → 中 0.13 → 近 0.20），不用任何图片。
 */

/** 正房：台基、明间、两侧次间。中央留空给标题。 */
function MainHall() {
  return (
    <g className="jijia-hall">
      {/* 明间里那点暗 —— 从亮院子往堂屋看，里面总是黑的 */}
      <path className="jijia-hall-shade" d="M 452,326 C 620,318 860,318 988,326 C 990,440 986,530 988,590 C 800,584 620,584 452,590 C 454,520 450,430 452,326 Z" />

      {/* 檐下横枋 */}
      <path className="jijia-line-mid" d="M 300,314 C 560,306 900,306 1140,316" />

      {/* 四根檐柱，明间（452–988）空着 */}
      <path className="jijia-line-mid" d="M 338,320 C 336,420 340,520 337,592" />
      <path className="jijia-line-far" d="M 452,322 C 450,420 454,520 451,592" />
      <path className="jijia-line-far" d="M 988,324 C 986,422 990,522 987,594" />
      <path className="jijia-line-mid" d="M 1102,326 C 1100,424 1104,524 1101,596" />

      {/* 次间的隔扇，只给两侧，明间留白 */}
      <path className="jijia-line-farther" d="M 372,368 C 370,452 374,536 371,590" />
      <path className="jijia-line-farther" d="M 412,366 C 410,452 414,536 411,590" />
      <path className="jijia-line-farther" d="M 1028,370 C 1026,454 1030,538 1027,592" />
      <path className="jijia-line-farther" d="M 1068,372 C 1066,454 1070,538 1067,594" />

      {/* 明间深处：只留两笔，其余交给空气 */}
      <path className="jijia-line-farther" d="M 500,376 C 498,458 502,540 499,588" />
      <path className="jijia-line-farther" d="M 940,378 C 938,460 942,542 939,590" />

      {/* 台基：上沿、下沿与三级踏跺 */}
      <path className="jijia-line-mid" d="M 288,594 C 560,588 900,590 1148,598" />
      <path className="jijia-line-mid" d="M 276,620 C 560,614 900,616 1160,624" />
      <path className="jijia-line-ground" d="M 470,628 C 620,624 800,625 934,630" />
      <path className="jijia-line-ground" d="M 452,646 C 616,642 806,643 952,648" />
      <path className="jijia-line-ground" d="M 432,666 C 612,661 812,662 972,668" />
    </g>
  )
}

/**
 * 屋顶。这里唯一用了填充而不是描线 —— 纯轮廓在这个淡度下永远是一枚扁梭子，
 * 只有给它一点体量，屋顶才压得住下面的院子。
 */
const ROOF_SILHOUETTE =
  'M 246,266 C 276,228 332,198 386,190 C 566,180 886,180 1062,190 ' +
  'C 1118,198 1170,228 1200,266 C 1176,290 1000,310 720,312 ' +
  'C 440,314 268,290 246,266 Z'

function Roof() {
  return (
    <g className="jijia-roof">
      <path className="jijia-roof-mass" d={ROOF_SILHOUETTE} />

      {/* 正脊 */}
      <path className="jijia-line-strong" d="M 386,190 C 566,181 886,181 1062,190" />

      {/* 两侧垂脊落到翼角，末端翘起来 */}
      <path className="jijia-line-strong" d="M 386,190 C 332,198 276,228 246,266" />
      <path className="jijia-line-strong" d="M 1062,190 C 1118,198 1170,228 1200,266" />

      {/* 檐口：中间沉、两端起翘 */}
      <path className="jijia-line-strong" d="M 246,266 C 268,290 440,314 720,312 C 1000,310 1176,290 1200,266" />
      <path className="jijia-line-near" d="M 300,282 C 480,302 600,310 720,312" />

      {/* 瓦垄：只描了几道，没描完 */}
      <path className="jijia-line-farther" d="M 470,186 C 462,226 456,262 452,296" />
      <path className="jijia-line-farther" d="M 570,182 C 566,224 562,262 560,306" />
      <path className="jijia-line-farther" d="M 900,182 C 902,224 906,262 908,306" />
      <path className="jijia-line-farther" d="M 992,186 C 998,226 1004,262 1010,296" />

      {/* 椽头 */}
      <path className="jijia-line-near" d="M 340,296 L 338,312 M 420,304 L 418,320 M 1024,306 L 1026,322 M 1104,296 L 1106,312" />
    </g>
  )
}

/** 右厢房：朝观看者斜退过来。有了这一笔才有院子。 */
function EastWing({ awake }) {
  return (
    <g className="jijia-wing">
      {/* 厢房檐口，从正房翼角一路斜下来 */}
      <path className="jijia-line-near" d="M 1196,272 C 1266,308 1328,354 1388,406" />
      <path className="jijia-line-mid" d="M 1192,292 C 1258,326 1318,370 1376,420" />

      {/* 两根柱子，越靠前越长 */}
      <path className="jijia-line-mid" d="M 1252,300 C 1250,424 1254,548 1251,634" />
      <path className="jijia-line-near" d="M 1332,354 C 1330,478 1334,596 1331,680" />

      {/* 墙根，与院子接上 */}
      <path className="jijia-line-mid" d="M 1188,600 C 1254,636 1318,678 1382,728" />

      {/* 墙上的画像，四角没有闭合 */}
      <path className="jijia-line-mid" d="M 1264,424 C 1290,420 1310,422 1320,421" />
      <path className="jijia-line-mid" d="M 1322,426 C 1324,462 1320,500 1323,528" />
      <path className="jijia-line-mid" d="M 1266,428 C 1264,464 1268,502 1265,530" />
      <path className="jijia-line-ground" d="M 1273,440 C 1292,437 1306,438 1314,437" />
      <path className="jijia-line-ground" d="M 1293,420 L 1293,408" />

      {/* 画像后面多出来的一圈，落到地面为止，没有下沿 */}
      <g className={`jijia-hidden-door${awake ? ' jijia-hidden-door--noticed' : ''}`}>
        <path d="M 1248,402 C 1284,396 1314,398 1340,402" />
        <path d="M 1248,402 C 1246,480 1250,558 1248,640" />
        <path d="M 1340,402 C 1342,486 1338,570 1340,660" />
      </g>
    </g>
  )
}

/** 院子：地面、铺石缝，和一只香炉。 */
function Courtyard() {
  return (
    <g className="jijia-yard">
      <path className="jijia-line-ground" d="M 196,672 C 540,664 860,662 1240,670" />
      <path className="jijia-line-ground" d="M 150,726 C 520,716 880,712 1290,722" />
      <path className="jijia-line-ground" d="M 96,798 C 500,784 900,778 1332,792" />
      <path className="jijia-line-ground" d="M 330,802 C 476,734 620,686 774,656" />
      <path className="jijia-line-ground" d="M 946,802 C 922,734 894,686 866,658" />

      {/* 香炉：三炷香，没人真信，但一直点着 */}
      <path className="jijia-line-mid" d="M 402,680 C 402,704 414,716 432,716 C 450,716 462,704 462,680" />
      <path className="jijia-line-mid" d="M 394,678 C 420,672 444,672 470,678" />
      <path className="jijia-line-branch" d="M 420,672 C 419,656 420,646 418,636" />
      <path className="jijia-line-branch" d="M 432,672 C 433,654 432,642 434,630" />
      <path className="jijia-line-branch" d="M 444,672 C 445,656 444,646 446,638" />
    </g>
  )
}

/** 前檐的一根柱子。只留一根 —— 两根就对称了，对称就是立面图。 */
function NearColumn() {
  return (
    <g className="jijia-near-column">
      <path className="jijia-line-mid" d="M 172,250 C 190,246 216,246 234,250" />
      <path className="jijia-line-mid" d="M 180,262 C 196,258 216,258 232,262" />
      <path className="jijia-line-near" d="M 196,270 C 194,400 198,560 195,706" />
      <path className="jijia-line-mid" d="M 210,274 C 208,402 212,558 209,704" />
      <path className="jijia-line-mid" d="M 178,706 C 202,702 222,704 238,707 C 232,724 186,724 178,706" />
    </g>
  )
}

/** 老槐树：只有伸进画面的几根枝子，树在画外。 */
function ScholarTree() {
  return (
    <g className="jijia-tree">
      <path className="jijia-line-branch" d="M 40,84 C 112,116 154,152 196,188" />
      <path className="jijia-line-branch" d="M 124,130 C 152,124 180,134 202,154" />
      <path className="jijia-line-branch" d="M 88,110 C 100,138 108,162 110,184" />
      <path className="jijia-line-branch" d="M 202,154 C 226,160 248,170 268,184" />
      <path className="jijia-line-branch" d="M 156,152 C 172,168 182,186 188,206" />
    </g>
  )
}

/** 一地碎影。上午十点的光从左上来，影子落在右下，中间夹着几块亮斑。 */
function DappledLight() {
  const shade = [
    [268, 692, 34, 13, -14], [352, 734, 20, 9, 8], [300, 786, 40, 15, -8],
    [432, 704, 15, 8, 20], [474, 756, 27, 11, -12], [388, 812, 18, 8, 6],
    [542, 720, 13, 7, -18], [580, 780, 31, 12, 10], [664, 734, 17, 8, -6],
    [716, 794, 24, 10, 14], [812, 752, 15, 7, -10], [884, 716, 20, 9, 4],
  ]
  return (
    <g className="jijia-dapple">
      {shade.map(([cx, cy, rx, ry, rot]) => (
        <ellipse
          key={`${cx}-${cy}`}
          className="jijia-dapple-shade"
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          transform={`rotate(${rot} ${cx} ${cy})`}
        />
      ))}
    </g>
  )
}

function LandingJijiaScene({ awake = false }) {
  return (
    <div className="landing-scene landing-scene--jijia" aria-hidden="true">
      <div className="landing-scene-light" />
      <div className="landing-scene-haze" />
      <svg
        className="landing-scene-svg"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 铅笔抖动。完美的贝塞尔曲线看起来像 CAD，不像有人拿笔画的。 */}
        <defs>
          <filter id="jijia-pencil" x="-6%" y="-6%" width="112%" height="112%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="7" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="7.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>

        <g className="jijia-far">
          <MainHall />
        </g>
        <g className="jijia-mid">
          <Courtyard />
          <EastWing awake={awake} />
        </g>
        <DappledLight />
        <g className="jijia-near">
          <Roof />
          <NearColumn />
          <ScholarTree />
        </g>
      </svg>
    </div>
  )
}

export default LandingJijiaScene
