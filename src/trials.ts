export function recordWindTrial(
  trials: string[],
  room: number,
  step: "rise" | "turn",
) {
  const id = `${step}-${room}`;
  if (!trials.includes(id)) trials.push(id);
  const seal = `seal-${room}`;
  if (
    trials.includes(`rise-${room}`) &&
    trials.includes(`turn-${room}`) &&
    !trials.includes(seal)
  ) {
    trials.push(seal);
    return true;
  }
  return false;
}
