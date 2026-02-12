/**
 * Office Page
 * 
 * Full-screen pixel art office visualization showing the AI team at work.
 * Route: /office
 */

import { OfficeScene } from '../components/office/OfficeScene';

export function OfficePage() {
  return (
    <div className="h-[calc(100vh-4rem)] w-full">
      <OfficeScene />
    </div>
  );
}
