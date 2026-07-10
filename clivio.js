function round4(n) {
    return Math.round(n * 1e4) / 1e4
}

function elem(tag, attrs = {}, text = null) {
    return { tag, attrs, text, children: [] }
}

function serialize({ tag, attrs, text, children }) {
    const attrStr = Object.entries(attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ")
    if (!text && !children.length)
        return `<${tag}${attrStr ? " " + attrStr : ""} />`
    const open = attrStr ? `<${tag} ${attrStr}>` : `<${tag}>`
    const inner = (text ?? "") + children.map(serialize).join("")
    return `${open}${inner}</${tag}>`
}

class AnimatedTerminalSVG {
    constructor(
        lines,
        {
            speed = 0.3,
            pause = 1.5,
            background = "#151b23",
            borderRadius = 10,
            fontColor = "#fff",
            fontSize = 20,
            font = "monospace",
            gap = 5,
            height = null,
            padding = 20,
            prompt = null,
            scale = null,
            width = 600,
            initialPause = 0.5,
        } = {},
    ) {
        this._lines = lines.trim().split("\n")
        this._prompt = prompt || this._lines[0].split(" ")[0] + " "
        this._speed = speed
        this._pause = pause
        this._initialPause = initialPause
        this._lineHeight = fontSize + gap

        scale ??= fontSize / 20
        this._charWidth = 12 * scale
        height ??= this._lines.length * this._lineHeight + 2 * padding

        this._svgAttrs = {
            xmlns: "http://www.w3.org/2000/svg",
            width: String(Math.round(width * scale)),
            height: String(Math.round(height * scale)),
            "font-family": font,
            "font-size": `${fontSize}px`,
            fill: fontColor,
        }
        this._rectAttrs = {
            width: "100%",
            height: "100%",
            rx: String(borderRadius),
            fill: background,
        }
        this._groupAttrs = {
            transform: `scale(${scale}) translate(${padding} ${padding + fontSize})`,
        }
        this._frames = []
        this._row = 0
        this._timer = 0
    }

    animate() {
        for (const line of this._lines) {
            if (line.startsWith(this._prompt)) {
                this._addPrompt()
                this._addCommand(line)
            } else {
                this._addOutput(line)
            }
        }
        this._timer += this._pause
    }

    _addFrame(element) {
        this._frames.push({ element, time: round4(this._timer) })
    }

    _addPrompt() {
        const el = elem(
            "text",
            {
                y: String(this._row * this._lineHeight),
                opacity: "0",
                style: "user-select: none;",
            },
            this._prompt,
        )
        this._addFrame(el)
        this._timer +=
            this._frames.length <= 1 ? this._initialPause : this._pause
    }

    _addCommand(line) {
        const command = line.slice(this._prompt.length)
        for (let i = 0; i < command.length; i++) {
            this._timer += this._speed
            const el = elem(
                "text",
                {
                    x: String((i + this._prompt.length) * this._charWidth),
                    y: String(this._row * this._lineHeight),
                    opacity: "0",
                },
                command[i],
            )
            this._addFrame(el)
        }
        this._row++
        this._timer += this._speed
    }

    _addOutput(line) {
        const el = elem(
            "text",
            { y: String(this._row * this._lineHeight), opacity: "0" },
            line.replace(/ /g, "\u00a0"),
        )
        this._addFrame(el)
        this._row++
    }

    _buildSvg() {
        const dur = round4(this._timer)
        const svg = elem("svg", this._svgAttrs)
        svg.children.push(elem("rect", this._rectAttrs))
        const group = elem("g", this._groupAttrs)
        for (const { element, time } of this._frames) {
            const t = round4(time / dur)
            const el = { ...element, children: [...element.children] }
            el.children.push(
                elem("animate", {
                    attributeName: "opacity",
                    values: "0;0;1;1;0",
                    keyTimes: `0;${t};${t};1;1`,
                    dur: `${+dur.toPrecision(4)}s`,
                    repeatCount: "indefinite",
                }),
            )
            group.children.push(el)
        }
        svg.children.push(group)
        return svg
    }

    render() {
        return serialize(this._buildSvg()).replace(/\u00a0/g, "&#160;") + "\n"
    }
}

const $ = (id) => document.getElementById(id)

function getOptions() {
    const prompt = $("prompt").value.trim()
    return {
        speed: parseFloat($("speed").value),
        pause: parseFloat($("pause").value),
        initialPause: parseFloat($("initialPause").value),
        width: parseInt($("width").value),
        fontSize: parseInt($("fontSize").value),
        padding: parseInt($("padding").value),
        background: $("background").value,
        fontColor: $("fontColor").value,
        borderRadius: parseInt($("borderRadius").value),
        ...(prompt ? { prompt } : {}),
    }
}

$("generate").addEventListener("click", () => {
    const lines = $("lines").value.trim()

    if (!lines) {
        return console.error("Please enter some terminal lines.")
    }

    try {
        const terminal = new AnimatedTerminalSVG(lines, getOptions())
        terminal.animate()
        const svg = terminal.render()

        const container = $("svg-container")
        container.innerHTML = svg

        $("output").style.display = "block"
        $("output").scrollIntoView({ behavior: "smooth", block: "start" })
    } catch (e) {
        error.textContent = `Error: ${e.message}`
        error.style.display = "block"
    }
})

$("copy").onclick = async () => {
  const svg = document.querySelector("svg");
  const svgString = new XMLSerializer().serializeToString(svg);
  await navigator.clipboard.writeText(svg.outerHTML);
};

$("download").onclick = async () => {
  const svg = document.querySelector("svg");
    const blob = new Blob([svg], { type: "image/svg+xml" })
    const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(blob),
        download: "terminal.svg",
    })
    a.click()
    URL.revokeObjectURL(a.href)
}