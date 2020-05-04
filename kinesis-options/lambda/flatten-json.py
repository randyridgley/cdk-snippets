def flatten(a_dict: dict):
    """
    remove all nested structures from a dictionary by flattening it
    :param a_dict: a dictionary
    :return: a flattened dictionary
    """
    d_return = dict()
    for k, v in a_dict.items():
        d_return.update(__f(k, v))
    return d_return


def __f(k, o):
    """
    recursive function to perform the flattening of the dictionary
    :param k: a key
    :param o: an object or primitive
    :return: a dictionary with no nested structures
    """
    return_dict = {}
    if isinstance(o, list):
        for i, j in enumerate(o):
            return_dict.update(__f('{}.{}'.format(k, i), j))
    elif isinstance(o, dict):
        for l, v in o.items():
            return_dict.update(__f('{}.{}'.format(k, l), v))
    else:
        return_dict = {k: o}
    return return_dict