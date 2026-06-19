import { useId } from "react"
import { smokeColumnStyle, smokeWispStyle } from "../utils/smoke"

type YaoSmokeWispsProps = {
	q: number
}

const WISP_PATHS = [
	"M42 140 C24 110 62 92 39 68 C22 50 44 36 34 9",
	"M47 140 C66 112 30 93 55 66 C72 47 45 34 58 7",
	"M35 140 C50 118 39 96 27 78 C10 52 65 42 43 10",
	"M45 140 C34 116 56 101 48 80 C39 58 49 38 41 14",
]

export function YaoSmokeWisps({ q }: YaoSmokeWispsProps) {
	const filterId = useId().replace(/:/g, "")
	const gradientId = filterId + "-gradient"

	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 88 148"
			style={smokeColumnStyle(q)}
			focusable="false"
		>
			<defs>
				<linearGradient id={gradientId} x1="0" x2="0" y1="1" y2="0">
					<stop offset="0%" stopColor="var(--char-smoke-soft)" stopOpacity="0" />
					<stop offset="38%" stopColor="var(--char-color-qian)" stopOpacity="0.5" />
					<stop offset="100%" stopColor="var(--char-smoke-soft)" stopOpacity="0" />
				</linearGradient>
				<filter id={filterId} x="-45%" y="-28%" width="190%" height="168%">
					<feTurbulence
						type="fractalNoise"
						baseFrequency="0.012 0.044"
						numOctaves="2"
						seed="7"
						result="noise"
					>
						<animate
							attributeName="baseFrequency"
							dur="9s"
							values="0.012 0.044;0.018 0.032;0.012 0.044"
							repeatCount="indefinite"
						/>
					</feTurbulence>
					<feDisplacementMap
						in="SourceGraphic"
						in2="noise"
						scale="7"
						xChannelSelector="R"
						yChannelSelector="G"
					/>
					<feGaussianBlur stdDeviation="0.72" />
				</filter>
			</defs>
			{WISP_PATHS.map((path, index) => (
				<path
					key={path}
					className="yao-smoke-wisp"
					d={path}
					filter={"url(#" + filterId + ")"}
					stroke={"url(#" + gradientId + ")"}
					style={smokeWispStyle(index)}
				/>
			))}
		</svg>
	)
}
