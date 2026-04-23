const icons = require('react-icons/fa6');
const requiredIcons = [
    'FaGlobe', 
    'FaTrophy', 
    'FaList', 
    'FaUserGear', 
    'FaUsers', 
    'FaNewspaper', 
    'FaRankingStar', 
    'FaShieldAlt',
    'FaUser',
    'FaUserGroup',
    'FaCommentDots'
];

console.log('Checking icons in react-icons/fa6...');
requiredIcons.forEach(iconName => {
    if (icons[iconName]) {
        console.log(`[OK] ${iconName} exists`);
    } else {
        console.error(`[MISSING] ${iconName} is undefined!`);
    }
});
