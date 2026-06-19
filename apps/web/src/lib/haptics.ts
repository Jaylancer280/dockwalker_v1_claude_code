// Haptic feedback no-ops. Web has no equivalent to native iOS/Android
// haptics; preserved as a stable surface so swipe components don't need
// platform branching at every callsite.

export async function hapticLight() {}
export async function hapticMedium() {}
export async function hapticHeavy() {}
export async function hapticSuccess() {}
export async function hapticError() {}
