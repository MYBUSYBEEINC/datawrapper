(function() {
    // numeral.js locale configuration
    // locale : norwegian (nynorsk)

    return {
        delimiters: {
            thousands: '.',
            decimal: ','
        },
        abbreviations: {
            thousand: 'k',
            million: 'm',
            billion: 'b',
            trillion: 't'
        },
        ordinal: function() {
            return '.';
        },
        currency: {
            symbol: 'kr'
        }
    };
})();
