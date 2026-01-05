import React, { useState } from "react";

export default function SnapContainer() {
	const totalBoxes = 4;
	const [coverBoxes, setCoverBoxes] = useState(0); // 0, 2 or 4
	const coverPercent = (coverBoxes / totalBoxes) * 100;

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
			{/* controls */}
			<div style={{ display: "flex", gap: 8 }}>
				<button onClick={() => setCoverBoxes(4)}>Snap 4</button>
				<button onClick={() => setCoverBoxes(2)}>Snap 2</button>
				<button onClick={() => setCoverBoxes(0)}>Reset</button>
			</div>

			{/* 4 vertical boxes with overlay */}
			<div
				style={{
					position: "relative",
					height: 200,
					display: "grid",
					gridTemplateColumns: `repeat(${totalBoxes}, 1fr)`,
					gap: 8,
				}}
			>
				{Array.from({ length: totalBoxes }).map((_, i) => (
					<div
						key={i}
						style={{
							background: "#f6f6f6",
							border: "1px solid #ddd",
							height: "100%",
						}}
					/>
				))}

				{/* overlay that "covers" N vertical boxes */}
				<div
					aria-hidden
					style={{
						position: "absolute",
						left: 0,
						top: 0,
						bottom: 0,
						width: `${coverPercent}%`,
						background: "rgba(0, 123, 255, 0.18)",
						transition: "width 200ms ease",
						pointerEvents: "none",
					}}
				/>
			</div>
		</div>
	);
}