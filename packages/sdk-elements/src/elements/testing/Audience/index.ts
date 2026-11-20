import BaseAudience from './Audience';
import AudienceVariant from './AudienceVariant';
import declaration from './declaration';

// The variant is a React component, so it is attached here rather than in the data-only declaration.
const Audience = Object.assign(BaseAudience, {
  ...declaration,
  plugins: {
    audienceVariant: AudienceVariant
  }
});

export default Audience;
