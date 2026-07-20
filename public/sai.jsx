import React from 'react'
import { useRef, useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import { v4 as uuidv4 } from 'uuid';

const Manager = () => {
    const ref = useRef()
    const passwordRef = useRef()
    const [form, setform] = useState({ site: "", username: "", password: "" })
    const [passwordArray, setPasswordArray] = useState([])
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStrength, setFilterStrength] = useState("");
    const [visiblePasswords, setVisiblePasswords] = useState({});
    const [passwordOptions, setPasswordOptions] = useState({
        length: 12,
        upper: true,
        lower: true,
        numbers: true,
        symbols: true,
    });

    // ✅ Fix: Safe JSON parsing
    useEffect(() => {
        let passwords = localStorage.getItem("passwords");
        if (passwords) {
            try {
                const parsed = JSON.parse(passwords);

                if (Array.isArray(parsed)) {
                    setPasswordArray(parsed);
                } else {
                    console.warn("Invalid data format in localStorage. Resetting.");
                    setPasswordArray([]);
                    localStorage.removeItem("passwords");
                }
            } catch (error) {
                console.error("Error parsing passwords from localStorage:", error);
                setPasswordArray([]);
                localStorage.removeItem("passwords");
            }
        }
    }, []);

    const copyText = (text) => {
        toast('Copied to clipboard!', { theme: "dark" });
        navigator.clipboard.writeText(text);
    }

    const showPassword = () => {
        passwordRef.current.type = "text"
        if (ref.current.src.includes("icons/delete.png")) {
            ref.current.src = "icons/eye.png"
            passwordRef.current.type = "text"
        }
        else {
            ref.current.src = "icons/delete.png"
            passwordRef.current.type = "password"
        }
    }

    const handleOptionChange = (e) => {
        const { name, checked } = e.target;
        setPasswordOptions({ ...passwordOptions, [name]: checked });
    };

    const handleLengthChange = (e) => {
        setPasswordOptions({ ...passwordOptions, length: Number(e.target.value) });
    };

    const generateStrongPassword = () => {
        const { length, upper, lower, numbers, symbols } = passwordOptions;
        let charset = "";
        if (upper) charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        if (lower) charset += "abcdefghijklmnopqrstuvwxyz";
        if (numbers) charset += "0123456789";
        if (symbols) charset += "!@#$%^&*()_+{}[]<>?";

        if (!charset) {
            toast.error("Select at least one option for password generation!", { theme: "dark" });
            return;
        }

        let password = "";
        for (let i = 0; i < length; i++) {
            password += charset[Math.floor(Math.random() * charset.length)];
        }

        setform({ ...form, password });
        toast.success("Strong Password Generated!", { theme: "dark" });
    };

    const getPasswordStrength = (password) => {
        let score = 0;
        if (password.length > 6) score++;
        if (password.length > 10) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;

        if (score <= 1) return { label: "Weak", color: "bg-red-500", width: "w-1/4" };
        if (score === 2) return { label: "Medium", color: "bg-yellow-500", width: "w-2/4" };
        if (score === 3) return { label: "Strong", color: "bg-green-500", width: "w-3/4" };
        return { label: "Very Strong", color: "bg-blue-600", width: "w-full" };
    };

    const togglePasswordVisibility = (id) => {
        setVisiblePasswords((prev) => ({
            ...prev,
            [id]: !prev[id],
        }));
    };

    // ✅ Fix: Generate ID once
    const savePassword = () => {
        if (form.site.length > 3 && form.username.length > 3 && form.password.length > 3) {
            const newEntry = { ...form, id: uuidv4() };
            const updatedArray = [...passwordArray, newEntry];

            setPasswordArray(updatedArray);
            setform({ site: "", username: "", password: "" });
            localStorage.setItem("passwords", JSON.stringify(updatedArray));

            toast('Password Saved', { theme: "dark" });
        } else {
            toast("Error: Password not Saved");
        }
    }

    const deletePassword = (id) => {
        let c = confirm("Do you really want to delete this password?");
        if (c) {
            const updatedArray = passwordArray.filter(item => item.id !== id);
            setPasswordArray(updatedArray);
            localStorage.setItem("passwords", JSON.stringify(updatedArray));
            toast('Password Deleted!', { theme: "dark" });
        }
    }

    const editPassword = (id) => {
        setform(passwordArray.filter(i => i.id === id)[0])
        setPasswordArray(passwordArray.filter(item => item.id !== id))
    }

    const handleChange = (e) => {
        setform({ ...form, [e.target.name]: e.target.value })
    }
    return (
        <>

            <ToastContainer
                position="top-right"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick={false}
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="dark"

            />

            <div className="absolute inset-0 -z-10 h-full w-full bg-white [background:radial-gradient(125%_125%_at_50%_10%,#fff_40%,#63e_100%)]"></div>
            <div className=' p-2 md:p-0 md:mycontainer min-h-89'>
                <h1 className='text-4xl font-bold text-center py-4'>
                    <span className='text-green-500'> &lt;</span>
                    Pass
                    <span className='text-green-500'>Op/ &gt;</span>
                </h1>
                <p className='text-green-700 text-lg text-center'>Your Own Password Manager</p>

                <div className='text-black flex flex-col p-4 gap-8 items-center'>
                    <input value={form.site} onChange={handleChange} placeholder="Enter website URL" className='rounded-full border border-green-500 w-full p-4 py-1' type='text' name='site' id='site' />
                    <div className='flex flex-col md:flex-row w-full gap-8'>
                        <input value={form.username} onChange={handleChange} placeholder="Enter Username" className='rounded-full border border-green-500 w-full p-4 py-1' type='text' name='username' id='username' />
                        <div className="flex flex-col gap-2 w-full">
                            <div className="flex w-full gap-3 items-center">
                                {/* Password Input */}
                                <div className="relative flex-1">
                                    <input
                                        ref={passwordRef}
                                        value={form.password}
                                        onChange={handleChange}
                                        placeholder="Enter Password"
                                        className='rounded-full border border-green-500 w-full p-4 py-1 pr-12'
                                        type='password'
                                        name='password'
                                        id='password'
                                    />
                                    {/* Eye Icon */}
                                    <span
                                        className='absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer'
                                        onClick={showPassword}
                                    >
                                        <img
                                            ref={ref}
                                            className="p-1 opacity-80 hover:opacity-100 transition"
                                            width={28}
                                            src='icons/eye.png'
                                            alt='eye'
                                        />
                                    </span>
                                </div>

                                {/* Generate Button */}
                                <button
                                    type="button"
                                    onClick={generateStrongPassword}
                                    className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white rounded-full px-4 py-2 text-sm font-semibold shadow-md transition"
                                >
                                    {/* Magic Wand Icon */}
                                    <svg xmlns="http://www.w3.org/2000/svg"
                                        fill="none" viewBox="0 0 24 24"
                                        strokeWidth={2} stroke="currentColor"
                                        className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 3.75l-.86 2.59a.75.75 0 01-.7.51H7.5l2.13 1.55a.75.75 0 01.27.84l-.86 2.59L12 10.5l2.96 1.28-.86-2.59a.75.75 0 01.27-.84L16.5 6.85h-2.19a.75.75 0 01-.7-.51L12.75 3.75M21 21l-5.5-5.5" />
                                    </svg>
                                    Generate
                                </button>
                            </div>
                            <div className="flex flex-col md:flex-row gap-3 items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" name="upper" checked={passwordOptions.upper} onChange={handleOptionChange} />
                                    <span>Uppercase</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" name="lower" checked={passwordOptions.lower} onChange={handleOptionChange} />
                                    <span>Lowercase</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" name="numbers" checked={passwordOptions.numbers} onChange={handleOptionChange} />
                                    <span>Numbers</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" name="symbols" checked={passwordOptions.symbols} onChange={handleOptionChange} />
                                    <span>Symbols</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label>Length:</label>
                                    <input type="number" min="6" max="32" value={passwordOptions.length} onChange={handleLengthChange} className="w-16 px-1 rounded-md" />
                                </div>
                            </div>



                            {/* Password Strength Meter */}
                            {form.password && (
                                <div className="w-full mt-1">
                                    <div className="h-2 rounded-full bg-gray-300">
                                        <div
                                            className={`h-2 rounded-full ${getPasswordStrength(form.password).color} ${getPasswordStrength(form.password).width}`}
                                        ></div>
                                    </div>
                                    <p className="text-sm mt-1 font-medium text-gray-200">
                                        Strength: <span className="text-white">{getPasswordStrength(form.password).label}</span>
                                    </p>
                                </div>
                            )}
                        </div>

                    </div>
                    <button onClick={savePassword} className='flex justify-center items-center gap-2 bg-green-500 hover:bg-green-400 rounded-full px-8 py-2 w-fit borderplaceholder=""  border-green-900'>
                        <lord-icon
                            src="https://cdn.lordicon.com/efxgwrkc.json"
                            trigger="hover">
                        </lord-icon>
                        Save Paswword</button>
                </div>

                {/* Search + Filter */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-3 mb-4">
                    {/* Search Bar */}
                    <input
                        type="text"
                        placeholder="🔍 Search by site or username..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full md:w-1/3 px-4 py-2 rounded-full border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400"
                    />

                    {/* Filter Dropdown */}
                    <select
                        value={filterStrength}
                        onChange={(e) => setFilterStrength(e.target.value)}
                        className="px-3 py-2 rounded-full border border-green-500 bg-gray-900 text-white"
                    >
                        <option value="">All Strengths</option>
                        <option value="Weak">Weak</option>
                        <option value="Medium">Medium</option>
                        <option value="Strong">Strong</option>
                        <option value="Very Strong">Very Strong</option>
                    </select>
                </div>


                <div className="passwords">
                    <h2 className='font-bold text-2xl py-4'>Your Passwords</h2>
                    {passwordArray.length === 0 && <div> No Password to show </div>}
                    {passwordArray.length != 0 &&
                        <div className="hidden md:block overflow-x-auto">
                            <table className="table-auto w-full border border-green-500 rounded-lg overflow-hidden shadow-md">
                                <thead className="bg-green-700 text-white">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Site</th>
                                        <th className="px-4 py-2 text-left">Username</th>
                                        <th className="px-4 py-2 text-left">Password</th>
                                        <th className="px-4 py-2 text-left">Strength</th>
                                        <th className="px-4 py-2 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-green-50 text-gray-800">

                                    {passwordArray
                                        .filter((item) => {
                                            const matchesSearch =
                                                item.site.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                item.username.toLowerCase().includes(searchQuery.toLowerCase());

                                            const matchesFilter =
                                                !filterStrength ||
                                                getPasswordStrength(item.password).label === filterStrength;

                                            return matchesSearch && matchesFilter;
                                        })
                                        .map((item) => (
                                            <tr
                                                key={item.id}
                                                className="border-b border-green-200 hover:bg-green-100 transition"
                                            >
                                                {/* Site */}
                                                <td className="px-4 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{item.site}</span>
                                                        <span
                                                            className="cursor-pointer"
                                                            onClick={() => copyText(item.site)}
                                                        >
                                                            <lord-icon
                                                                src="https://cdn.lordicon.com/rrbmabsx.json"
                                                                trigger="hover"
                                                                style={{ width: "22px", height: "22px" }}
                                                            ></lord-icon>
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Username */}
                                                <td className="px-4 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <span>{item.username}</span>
                                                        <span
                                                            className="cursor-pointer"
                                                            onClick={() => copyText(item.username)}
                                                        >
                                                            <lord-icon
                                                                src="https://cdn.lordicon.com/rrbmabsx.json"
                                                                trigger="hover"
                                                                style={{ width: "22px", height: "22px" }}
                                                            ></lord-icon>
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Password */}
                                                <td className="px-4 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono">
                                                            {visiblePasswords[item.id] ? item.password : "••••••••"}
                                                        </span>

                                                        {/* Eye Toggle */}
                                                        <span
                                                            className="cursor-pointer"
                                                            onClick={() => togglePasswordVisibility(item.id)}
                                                        >
                                                            <img
                                                                src={
                                                                    visiblePasswords[item.id]
                                                                        ? "icons/delete.png"
                                                                        : "icons/eye.png"
                                                                }
                                                                alt="toggle visibility"
                                                                className="w-6 h-6 opacity-80 hover:opacity-100 transition"
                                                            />
                                                        </span>

                                                        {/* Copy Button */}
                                                        <span
                                                            className="cursor-pointer"
                                                            onClick={() => copyText(item.password)}
                                                        >
                                                            <lord-icon
                                                                src="https://cdn.lordicon.com/rrbmabsx.json"
                                                                trigger="hover"
                                                                style={{ width: "22px", height: "22px" }}
                                                            ></lord-icon>
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Strength */}
                                                <td className="px-4 py-2">
                                                    {(() => {
                                                        const strength = getPasswordStrength(item.password);
                                                        let color = "bg-gray-300 text-gray-900"; // default

                                                        if (strength.label === "Weak")
                                                            color = "bg-red-200 text-red-800";
                                                        if (strength.label === "Medium")
                                                            color = "bg-yellow-200 text-yellow-800";
                                                        if (strength.label === "Strong")
                                                            color = "bg-green-200 text-green-800";
                                                        if (strength.label === "Very Strong")
                                                            color = "bg-blue-200 text-blue-800";

                                                        return (
                                                            <span
                                                                className={`px-2 py-1 text-xs font-semibold rounded-lg ${color}`}
                                                            >
                                                                {strength.label}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>

                                                {/* Actions */}
                                                <td className="px-4 py-2 flex justify-center gap-4">
                                                    {/* Edit */}
                                                    <span
                                                        className="cursor-pointer"
                                                        onClick={() => editPassword(item.id)}
                                                    >
                                                        <lord-icon
                                                            src="https://cdn.lordicon.com/exymduqj.json"
                                                            trigger="hover"
                                                            style={{ width: "25px", height: "25px" }}
                                                        ></lord-icon>
                                                    </span>

                                                    {/* Delete */}
                                                    <span
                                                        className="cursor-pointer"
                                                        onClick={() => deletePassword(item.id)}
                                                    >
                                                        <lord-icon
                                                            src="https://cdn.lordicon.com/oqeixref.json"
                                                            trigger="hover"
                                                            style={{ width: "25px", height: "25px" }}
                                                        ></lord-icon>
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>

                    }
                </div>
            </div>

        </>
    )
}

export default Manager   