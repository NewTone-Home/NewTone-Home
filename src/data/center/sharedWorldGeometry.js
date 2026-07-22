export const CENTER_WORLD_VIEWBOX = '0 0 1000 360'

export const sharedWorldGeometry = Object.freeze({
  viewBox: CENTER_WORLD_VIEWBOX,
  roads: [
    {
      id: 'main-arterial',
      kind: 'arterial',
      d: 'M 42 254 C 154 239 242 257 338 246 C 445 234 520 211 618 220 C 738 231 839 251 958 236',
    },
    {
      id: 'north-arterial',
      kind: 'arterial',
      d: 'M 76 113 C 188 91 301 108 402 100 C 511 91 638 77 770 96 C 844 107 900 118 946 116',
    },
    {
      id: 'estate-link',
      kind: 'secondary',
      d: 'M 218 111 C 221 149 231 181 258 207 C 282 229 309 239 342 246',
    },
    {
      id: 'west-grid',
      kind: 'secondary',
      d: 'M 104 151 C 161 158 216 158 279 149 M 135 205 C 196 194 252 201 305 215',
    },
    {
      id: 'east-grid',
      kind: 'secondary',
      d: 'M 681 151 C 746 143 815 151 882 172 M 659 205 C 730 196 801 204 881 223',
    },
    {
      id: 'council-axis',
      kind: 'axis',
      d: 'M 520 42 L 520 314',
    },
    {
      id: 'council-cross-axis',
      kind: 'axis-secondary',
      d: 'M 416 182 C 458 178 484 179 520 182 C 556 185 589 184 627 177',
    },
  ],
  districts: [
    {
      id: 'main-city-boundary',
      kind: 'city',
      d: 'M 78 126 C 127 97 211 91 293 111 C 351 125 390 165 398 211 C 407 263 365 305 295 322 C 218 340 122 316 83 278 C 46 241 39 157 78 126 Z',
    },
    {
      id: 'jijia-block',
      kind: 'block',
      d: 'M 152 112 L 282 103 L 318 142 L 301 210 L 205 226 L 140 187 Z',
    },
    {
      id: 'council-precinct',
      kind: 'precinct',
      d: 'M 440 118 L 590 116 L 633 172 L 602 248 L 523 274 L 443 245 L 405 181 Z',
    },
    {
      id: 'mine-fringe',
      kind: 'mine',
      d: 'M 672 126 C 741 102 834 116 901 158 L 952 220 L 915 299 C 843 325 735 319 671 284 L 637 216 Z',
    },
    {
      id: 'north-blank',
      kind: 'blank',
      d: 'M 316 35 C 373 20 438 29 470 61 L 446 91 C 391 99 337 88 300 66 Z',
    },
    {
      id: 'south-blank',
      kind: 'blank',
      d: 'M 390 284 C 445 267 503 286 548 318 L 520 349 L 405 346 L 366 316 Z',
    },
  ],
  infrastructure: [
    {
      id: 'overpass',
      kind: 'overpass',
      d: 'M 34 76 C 169 55 292 72 410 64 C 543 55 670 44 811 69 C 866 79 916 88 966 84',
    },
    {
      id: 'drainage',
      kind: 'drainage',
      d: 'M 66 304 C 172 277 279 302 383 288 C 489 274 568 293 657 301 C 754 310 852 294 947 267',
    },
    {
      id: 'underground-pipeline',
      kind: 'pipeline',
      d: 'M 108 331 C 229 308 337 329 437 310 C 552 289 660 319 770 298 C 847 283 902 268 958 244',
    },
    {
      id: 'mine-direction',
      kind: 'direction',
      d: 'M 874 132 L 950 104 M 950 104 L 931 101 M 950 104 L 939 120',
    },
  ],
  anchors: {
    jijia: { x: 226, y: 170, width: 240, height: 160, scale: 0.9 },
    council: { x: 520, y: 190, width: 220, height: 166, scale: 0.82 },
    mainCity: { x: 244, y: 240, width: 270, height: 176, scale: 0.92 },
    mine: { x: 800, y: 230, width: 252, height: 174, scale: 0.9 },
  },
})
