import { smokeAshStyle, smokeColumnStyle, smokeWispStyle } from "../utils/smoke"

type YaoSmokeWispsProps = {
	q: number
}

const WISPS = [0, 1]
const ASHES = [0, 1, 2, 3]

export function YaoSmokeWisps({ q }: YaoSmokeWispsProps) {
	if (q < 1) return null

	return (
		<div className="yao-ash-field" style={smokeColumnStyle()} aria-hidden="true">
			{WISPS.map((index) => (
				<span
					key={"wisp-" + index}
					className="yao-short-wisp"
					style={smokeWispStyle(index)}
				/>
			))}
			{ASHES.map((index) => (
				<span
					key={"ash-" + index}
					className="yao-ash-particle"
					style={smokeAshStyle(index)}
				/>
			))}
		</div>
	)
}
