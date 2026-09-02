# Shared Styles - AI Context

Reusable SCSS for CSS Modules. All AstraDraw components import from here.

## Files

| File | Purpose |
| --- | --- |
| `_variables.scss` | `$ui-font`, spacing (`$spacing-md`), radius, transitions, z-index |
| `_mixins.scss` | `@mixin dark-mode`, `@mixin truncate`, `@mixin custom-scrollbar` |
| `_animations.scss` | `shimmer`, `fadeIn`, `spin` keyframes |
| `index.scss` | Global entry point (imports all) |

## Usage in CSS Modules

```scss
@use "../../styles/mixins" as *;
@use "../../styles/variables" as *;

.card {
  font-family: $ui-font;
  padding: $spacing-md;
}

@include dark-mode {
  .card {
    background: #232329;
  }
}
```

## Key Mixin: dark-mode

Wraps content in both dark mode selectors:

```scss
@include dark-mode {
  .element {
    color: white;
  }
}
// Outputs: :global(.excalidraw.theme--dark), :global(.excalidraw-app.theme--dark) { ... }
```

## Adding New Mixins

1. Add to `_mixins.scss` with documentation comment
2. Use `:global()` wrapper for class selectors that need to match parent containers
