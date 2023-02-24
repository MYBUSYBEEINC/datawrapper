(function() {
    // numeral.js locale configuration
    // locale : norwegian (bokmål)
    // author : Ove Andersen : https://github.com/azzlack

    return {
        delimiters: {
            thousands: String.fromCharCode(160),
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
