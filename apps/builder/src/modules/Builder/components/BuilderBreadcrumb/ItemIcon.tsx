import Icon from '@plitzi/plitzi-ui/Icon';
import PlitziLogo from '@plitzi/plitzi-ui/icons/PlitziLogo';

const ItemIcon = ({ icon }: { icon: string }) => {
  return (
    <>
      {icon && typeof icon === 'string' && !icon.startsWith('http') && <Icon intent="custom" icon={icon} />}
      {icon && typeof icon === 'string' && icon.startsWith('http') && (
        <Icon intent="custom">
          <img src={icon} />
        </Icon>
      )}
      {icon && typeof icon !== 'string' && <Icon intent="custom">{icon}</Icon>}
      {!icon && (
        <Icon intent="custom">
          <PlitziLogo />
        </Icon>
      )}
    </>
  );
};
export default ItemIcon;
