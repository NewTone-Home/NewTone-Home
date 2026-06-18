import { PUFF_DELAYS_MS } from "../constants"
import { puffStyle, puffsContainerStyle } from "../utils/puffs"

type YaoHumidifierPuffsProps = {
	q: number
}

export function YaoHumidifierPuffs({ q }: YaoHumidifierPuffsProps) {
	return (
		<div style={puffsContainerStyle(q)}>
			{PUFF_DELAYS_MS.map((delay, index) => (
				<div
					key={delay}
					className="yao-humidifier-puff"
					style={Object.assign({ animationDelay: delay + "ms" }, puffStyle(index))}
				/>
			))}
		</div>
	)
}
