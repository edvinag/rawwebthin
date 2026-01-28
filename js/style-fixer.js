const expressionNames = new Set([
    'literal',
    'get',
    'has',
    'in',
    '!in',
    'to-string',
    'to-number',
    'to-boolean',
    'typeof',
    'id',
    'zoom',
    'geometry-type',
    'line-progress',
    'accumulated',
    'at',
    'index-of',
    'slice',
    'case',
    'match',
    'step',
    'interpolate',
    'interpolate-hcl',
    'interpolate-lab',
    'coalesce',
    'let',
    'var',
    'concat',
    'downcase',
    'upcase',
    'resolved-locale',
    'rgb',
    'rgba',
    'hsl',
    'hsla',
    '+',
    '-',
    '*',
    '/',
    '%',
    '^',
    'min',
    'max',
    'round',
    'floor',
    'ceil',
    'sqrt',
    'log10',
    'ln',
    'log2',
    'sin',
    'cos',
    'tan',
    'asin',
    'acos',
    'atan',
    'abs',
    'length',
    'any',
    'all',
    '!',
    '==',
    '!=',
    '>',
    '>=',
    '<',
    '<=',
    'within',
    'distance'
]);

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

const isExpression = (v) =>
    Array.isArray(v) && typeof v[0] === 'string' && expressionNames.has(v[0]);

const isLiteralArray = (v) => {
    if (!Array.isArray(v)) return false;
    if (v.length === 0) return true;
    if (isExpression(v)) return false;

    return v.every(
        (x) =>
            typeof x === 'number' ||
            typeof x === 'string' ||
            typeof x === 'boolean' ||
            x === null
    );
};

const wrapLiteralArraysInsideExpressions = (node) => {
    if (!Array.isArray(node)) return node;
    if (node[0] === 'literal') return node;

    if (isExpression(node)) {
        const name = node[0];

        for (let i = 1; i < node.length; i += 1) {
            if (
                (name === 'interpolate' ||
                    name === 'interpolate-hcl' ||
                    name === 'interpolate-lab') &&
                i === 1
            ) {
                continue;
            }

            const child = node[i];

            if (isLiteralArray(child)) {
                node[i] = ['literal', child];
                continue;
            }

            if (Array.isArray(child)) {
                node[i] = wrapLiteralArraysInsideExpressions(child);
            }
        }
    }

    return node;
};

const patchLayerLayoutProperty = (layer, propName) => {
    if (!layer || !layer.layout || layer.layout[propName] === undefined) return;

    const v = layer.layout[propName];

    if (Array.isArray(v)) {
        layer.layout[propName] = wrapLiteralArraysInsideExpressions(v);
    }
};

const patchInvalidColors = (value) => {
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i += 1) {
            const v = value[i];

            if (v === 'hsla(0, 0, 0, 0)') {
                value[i] = 'hsla(0, 0%, 0%, 0)';
                continue;
            }

            if (v && typeof v === 'object') patchInvalidColors(v);
        }

        return;
    }

    if (isPlainObject(value)) {
        Object.keys(value).forEach((k) => patchInvalidColors(value[k]));
    }
};

const fixStyleJson = (style) => {
    patchInvalidColors(style);

    if (Array.isArray(style.layers)) {
        for (let i = 0; i < style.layers.length; i += 1) {
            const layer = style.layers[i];

            patchLayerLayoutProperty(layer, 'icon-offset');
            patchLayerLayoutProperty(layer, 'text-font');
        }
    }

    return style;
};

const loadAndFixStyle = async (styleUrl) => {
    const res = await fetch(styleUrl);
    if (!res.ok) throw new Error(`Failed to load style: ${res.status}`);

    const style = await res.json();
    return fixStyleJson(style);
};
