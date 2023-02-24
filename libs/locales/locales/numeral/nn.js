(function() {
    // numeral.js locale configuration
    // locale : norwegian (bokmål)

    return {
        delimiters: {
            thousands: '.',
            decimal: ','
        },
        abbreviations: {
            thousand: 'k',
            million: 'mill',
            billion: 'mrd',
            trillion: 'bill'
        },
        ordinal: function() {
            return '.';
        },
        currency: {
            symbol: 'kr'
        }
    };
})();
