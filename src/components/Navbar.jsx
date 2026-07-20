import React from 'react';

const Navbar = () => {
  return (
    <nav className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-md sticky top-0 z-50">
      <div className="mycontainer max-w-7xl mx-auto flex justify-between items-center px-6 py-4 h-16">
        
        {/* Logo */}
        <div className="logo font-extrabold text-2xl tracking-wide flex items-center">
          <span className="text-green-500">&lt;</span>
          Pass
          <span className="text-green-500">Op/&gt;</span>
        </div>

        {/* Navigation Links */}
        <ul className="hidden md:flex gap-8 font-medium">
          <li>
            <a
              className="relative hover:text-green-400 transition duration-200 after:content-[''] after:block after:w-0 after:h-[2px] after:bg-green-400 after:transition-all after:duration-300 hover:after:w-full"
              href="home.html"
            >
              Home
            </a>
          </li>
          <li>
            <a
              className="relative hover:text-green-400 transition duration-200 after:content-[''] after:block after:w-0 after:h-[2px] after:bg-green-400 after:transition-all after:duration-300 hover:after:w-full"
              href="contact.html"
            >
              Contact
            </a>
          </li>
        </ul>

        {/* GitHub Button */}
        <button
          onClick={() =>
            window.open('https://github.com/topics/mini-project', '_blank')
          }
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold shadow-md transform transition duration-200 hover:scale-105 hover:shadow-green-400/40"
        >
          <img
            className="invert w-6 h-6"
            src="/icons/github.png"
            alt="github-logo"
          />
          GitHub
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
