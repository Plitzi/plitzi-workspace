import BaseCarousel from './Carousel';
import CarouselTrack from './CarouselTrack';
import declaration from './declaration';

// The track is a React component, so it is attached here rather than in the data-only declaration.
const Carousel = Object.assign(BaseCarousel, { ...declaration, plugins: { carouselTrack: CarouselTrack } });

export default Carousel;
