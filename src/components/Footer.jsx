import React from 'react'

const Footer = () => {
    return (
        <div className='bg-slate-700 text-white flex flex-col justify-center items-center w-full'>
            <div className='logo font-bold'>
                    <span className='text-green-500'> &lt;</span>
                    Pass
                    <span className='text-green-500'>Op/ &gt;</span>
                    </div>
            <div className='flex p-1 justify-center items-center'>
                Created with  <img className=' w-5 mx-2' src='/icons/heart.png' alt='heart' />  by Tameshwar
            </div>
        </div>
    )
}

export default Footer