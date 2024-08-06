import CallToAction from "../sections/LandingCommons/CallToAction";
import Footer from "../sections/LandingCommons/Footer";
import Hero from "../sections/LandingCommons/Hero";
import LogoTicker from "../sections/LandingCommons/LogoTicker";
import Packages from "../sections/LandingCommons/Packages";
import Pricing from "../sections/LandingCommons/Pricing";
import ProductShow from "../sections/LandingCommons/ProductShowCase";
import Testimonials from "../sections/LandingCommons/Testimonials";

const LandingPage = () => {
  return (
    <div>
      <Hero />
      {/* <LogoTicker /> */}
      <ProductShow />
      <Pricing />
      <Packages />
      <Testimonials />
      <CallToAction />
      <Footer />
    </div>
  );
};

export default LandingPage;




// const LandingPage = () => {
//   return (
//     <div>
//       <header className="px-4 py-20 text-center text-white bg-gray-800">
//         <h1 className="mb-4 text-4xl font-bold">Welcome to the Training School</h1>
//         <p className="mb-8 text-xl">Enhance your skills with our comprehensive courses.</p>
//         <a
//           href="/auth/register"
//           className="px-4 py-2 font-bold text-white transition duration-300 bg-blue-500 rounded hover:bg-blue-700"
//         >
//           Get Started
//         </a>
//       </header>

//       <section className="px-4 py-20 bg-gray-100">
//         <div className="container mx-auto text-center">
//           <h2 className="mb-8 text-3xl font-bold">Our Features</h2>
//           <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
//             <div className="p-4 transition duration-300 bg-white rounded shadow hover:shadow-lg">
//               <h3 className="mb-4 text-2xl font-bold">Interactive Courses</h3>
//               <p>Learn through hands-on projects and real-world examples.</p>
//             </div>
//             <div className="p-4 transition duration-300 bg-white rounded shadow hover:shadow-lg">
//               <h3 className="mb-4 text-2xl font-bold">Expert Instructors</h3>
//               <p>Get guidance from industry experts with years of experience.</p>
//             </div>
//             <div className="p-4 transition duration-300 bg-white rounded shadow hover:shadow-lg">
//               <h3 className="mb-4 text-2xl font-bold">Flexible Schedule</h3>
//               <p>Study at your own pace with our flexible learning options.</p>
//             </div>
//           </div>
//         </div>
//       </section>

//       <section className="px-4 py-20">
//         <div className="container mx-auto text-center">
//           <h2 className="mb-8 text-3xl font-bold">Join Us Today</h2>
//           <p className="mb-8 text-xl">Sign up now and start your learning journey with us.</p>
//           <a
//             href="/auth/register"
//             className="px-4 py-2 font-bold text-white transition duration-300 bg-blue-500 rounded hover:bg-blue-700"
//           >
//             Register Now
//           </a>
//         </div>
//       </section>

//       <footer className="py-4 text-center text-white bg-gray-800">
//         <p>&copy; {new Date().getFullYear()} Training School. All rights reserved.</p>
//       </footer>
//     </div>
//   );
// };

// export default LandingPage;
