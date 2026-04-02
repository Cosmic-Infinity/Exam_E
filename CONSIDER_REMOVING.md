# Candidates for Removal or Custom Implementation

As part of our strategy to reduce supply chain vulnerabilities, minimize bundle size, and decrease maintenance burden, we have identified several frontend dependencies that are potentially underutilized or easily replaceable with custom logic or backend delegation.

## 1. Specialized User Interface Widgets

These are single-purpose libraries that might be adding unnecessary weight if their features are only used sparingly.

- **`embla-carousel-react`**: Provides image/content carousel sliders.
  - _Alternative_: If the application only requires a simple slider without complex swipe physics, this can be built with basic CSS scroll snapping or a lightweight custom React component.
- **`cmdk`**: A command-palette interface (similar to macOS Spotlight).
  - _Alternative_: If the system doesn't rely heavily on command palettes, this can be removed entirely or replaced by a custom search input box.
- **`input-otp`**: Specifically designed for One-Time Password input fields.
  - _Alternative_: Can be implemented using a series of standard HTML `<input>` elements coupled with basic React state and focus management logic.
- **`vaul`**: A drawer component typically used for mobile slide-up panels.
  - _Alternative_: Can be constructed using standard Radix UI Dialog primitives or custom CSS transitions if Radix is already in use.
- **`sonner`**: A toast notification library.
  - _Alternative_: Though lightweight, if we are already using Radix UI's Toast primitive, maintaining `sonner` as a separate dependency might be redundant.

## Next Steps

1. Audit the current usage of these components in the `docker/frontend/src` directory.
2. Determine if the engineering effort to replace them with custom logic outweighs the maintenance and security cost of keeping them.
3. Create tickets for the removal/replacement of the approved candidates.
