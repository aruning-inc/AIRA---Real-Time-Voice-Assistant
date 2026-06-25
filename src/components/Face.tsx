import { Eyes } from "./Eyes";
import { Mouth } from "./Mouth";

export function Face() {
  return (
    <div className="flex flex-col items-center justify-center">
      <Eyes />
      <Mouth />
    </div>
  );
}
