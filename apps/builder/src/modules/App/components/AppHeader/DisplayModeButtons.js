// Packages
import { useCallback, use } from 'react';
import IconGroup from '@plitzi/plitzi-ui/IconGroup';
import DesktopWithMobile from '@plitzi/plitzi-ui/icons/DesktopWithMobile';

// Alias
import AppContext from '@pmodules/App/AppContext';

const DisplayModeButtons = () => {
  const { displayMode, setDisplayMode, mobilePreview, setMobilePreview } = use(AppContext);

  const handleMobilePreview = useCallback(() => setMobilePreview(state => !state), [setMobilePreview]);

  const handleClickModeDesktop = useCallback(() => setDisplayMode('desktop'), [setDisplayMode]);

  const handleClickModeTablet = useCallback(() => setDisplayMode('tablet'), [setDisplayMode]);

  const handleClickModeMobile = useCallback(() => setDisplayMode('mobile'), [setDisplayMode]);

  return (
    <IconGroup size="lg" gap={4}>
      <IconGroup.Icon className="relative" cursor="pointer" active={mobilePreview} onClick={handleMobilePreview}>
        <DesktopWithMobile />
      </IconGroup.Icon>
      <IconGroup.Icon
        icon="fas fa-desktop"
        title="Mode: Desktop"
        cursor="pointer"
        onClick={handleClickModeDesktop}
        active={displayMode === 'desktop'}
      />
      <IconGroup.Icon
        icon="fas fa-tablet-alt"
        title="Mode: Tablet"
        cursor="pointer"
        onClick={handleClickModeTablet}
        active={displayMode === 'tablet'}
      />
      <IconGroup.Icon
        icon="fas fa-mobile-alt"
        title="Mode: Mobile"
        cursor="pointer"
        onClick={handleClickModeMobile}
        active={displayMode === 'mobile'}
      />
    </IconGroup>
  );
};

export default DisplayModeButtons;
