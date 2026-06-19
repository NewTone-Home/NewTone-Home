import { useId } from "react"
import { smokeColumnStyle, smokeWispStyle } from "../utils/smoke"

type YaoSmokeWispsProps = {
	q: number
}

const WISP_PATHS = [
	"M34 104 C22 82 48 72 34 52 C23 36 38 24 30 7",
	"M38 104 C51 82 25 68 43 48 C55 34 37 23 46 6",
	"M31 105 C42 88 34 75 27 61 C18 43 49 31 37 9",
]

export function YaoSmokeWisps({ q }: YaoSmokeWispsProps) {
	const filterId = useId().replace(/:/g, "")

	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 72 112"
			style={smokeColumnStyle(q)}
			focusable="false"
		>
			<defs>
				<filter id={filterId} x="-45%" y="-25%" width="190%" height="160%">
					<feTurbulence
						type="fractalNoise"
						baseFrequency="0.014 0.055"
						numOctaves="2"
						seed="7"
						result="noise"
					>
						<animate
							attributeName="baseFrequency"
							dur="7s"
							values="0.014 0.055;0.021 0.038;0.014 0.055"
							repeatCount="indefinite"
						/>
					</feTurbulence>
					<feDisplacementMap
						in="SourceGraphic"
						in2="noise"
						scale="9"
						xChannelSelector="R"
						yChannelSelector="G"
					/>
					<feGaussianBlur stdDeviation="0.55" />
				</filter>
			</defs>
			{WISP_PATHS.map((path, index) => (
				<path
					key={path}
					className="yao-smoke-wisp"
					d={path}
					filter={"url(#" + filterId + ")"}
					style={smokeWispStyle(index)}
				/>
			))}
		</svg>
	)
}
